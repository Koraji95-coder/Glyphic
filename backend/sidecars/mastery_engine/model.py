"""Core Bayesian mastery model using PyMC."""

import logging
import numpy as np
import pymc as pm
import arviz as az
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MasteryEstimate:
    """Estimated mastery level for a topic."""
    
    topic: str
    point_estimate: float  # Mean of posterior
    lower_95: float  # 95% credible interval lower bound
    upper_95: float  # 95% credible interval upper bound
    probability_mastery: float  # P(θ > 0.7)
    sample_count: int  # Number of attempts
    batch_id: str  # Tracking identifier


class BayesianMasteryModel:
    """Bayesian model for student mastery estimation.
    
    Uses a Beta-Binomial conjugate prior model:
    - Prior: Beta(α=2, β=5)  [pessimistic: assumes student starts behind]
    - Likelihood: Binomial(n_correct, n_total)
    - Posterior: Beta(α + n_correct, β + n_incorrect)
    
    The model computes credible intervals and posterior predictive distributions
    to estimate mastery with uncertainty quantification.
    """
    
    def __init__(self, prior_alpha: float = 2.0, prior_beta: float = 5.0):
        """Initialize Bayesian model with prior parameters.
        
        Args:
            prior_alpha: Shape parameter α for Beta prior
            prior_beta: Shape parameter β for Beta prior
        """
        self.prior_alpha = prior_alpha
        self.prior_beta = prior_beta
        self.trace = None
    
    def compute_posterior_analytical(
        self,
        n_correct: int,
        n_total: int,
        mastery_threshold: float = 0.7
    ) -> MasteryEstimate:
        """Compute posterior analytically using conjugate prior.
        
        For Beta-Binomial model, the posterior is:
        θ | data ~ Beta(α + n_correct, β + n_incorrect)
        
        Args:
            n_correct: Number of correct attempts
            n_total: Total number of attempts
            mastery_threshold: Threshold for "mastery" classification (default 0.7)
        
        Returns:
            MasteryEstimate with posterior summary statistics
        """
        if n_total == 0:
            # No data: return prior
            return MasteryEstimate(
                topic="unknown",
                point_estimate=self.prior_alpha / (self.prior_alpha + self.prior_beta),
                lower_95=self._beta_quantile(0.025, self.prior_alpha, self.prior_beta),
                upper_95=self._beta_quantile(0.975, self.prior_alpha, self.prior_beta),
                probability_mastery=1 - self._beta_cdf(mastery_threshold, self.prior_alpha, self.prior_beta),
                sample_count=0,
                batch_id="none"
            )
        
        # Posterior parameters
        n_incorrect = n_total - n_correct
        alpha_post = self.prior_alpha + n_correct
        beta_post = self.prior_beta + n_incorrect
        
        # Posterior mean
        point_estimate = alpha_post / (alpha_post + beta_post)
        
        # Credible interval (95%)
        lower_95 = self._beta_quantile(0.025, alpha_post, beta_post)
        upper_95 = self._beta_quantile(0.975, alpha_post, beta_post)
        
        # Probability mastery > threshold
        probability_mastery = 1 - self._beta_cdf(mastery_threshold, alpha_post, beta_post)
        
        return MasteryEstimate(
            topic="unknown",
            point_estimate=point_estimate,
            lower_95=lower_95,
            upper_95=upper_95,
            probability_mastery=probability_mastery,
            sample_count=n_total,
            batch_id="none"
        )
    
    def compute_posterior_pymc(
        self,
        n_correct: int,
        n_total: int,
        draws: int = 1000,
        mastery_threshold: float = 0.7
    ) -> Tuple[MasteryEstimate, az.InferenceData]:
        """Compute posterior using PyMC for validation/complex scenarios.
        
        Uses variational inference for scalability. Produces identical results
        to analytical solution for simple Beta-Binomial model.
        
        Args:
            n_correct: Number of correct attempts
            n_total: Total number of attempts
            draws: Number of posterior samples
            mastery_threshold: Threshold for "mastery"
        
        Returns:
            Tuple of (MasteryEstimate, InferenceData for diagnostics)
        """
        if n_total == 0:
            return self.compute_posterior_analytical(
                0, 0, mastery_threshold
            ), None
        
        with pm.Model() as model:
            # Prior
            theta = pm.Beta("theta", alpha=self.prior_alpha, beta=self.prior_beta)
            
            # Likelihood
            obs = pm.Binomial("obs", n=n_total, p=theta, observed=n_correct)
            
            # Inference using variational Bayes (fast, scalable)
            approx = pm.fit(
                n=50000,
                method=pm.ADVI(),
                return_approx=True,
                progressbar=False
            )
            trace = approx.sample(draws)
        
        # Extract posterior samples
        theta_samples = trace.posterior["theta"].values.flatten()
        
        # Compute statistics
        point_estimate = np.mean(theta_samples)
        lower_95 = np.percentile(theta_samples, 2.5)
        upper_95 = np.percentile(theta_samples, 97.5)
        probability_mastery = np.mean(theta_samples > mastery_threshold)
        
        return MasteryEstimate(
            topic="unknown",
            point_estimate=point_estimate,
            lower_95=lower_95,
            upper_95=upper_95,
            probability_mastery=probability_mastery,
            sample_count=n_total,
            batch_id="pymc"
        ), az.from_pymc3(trace)
    
    def batch_update(
        self,
        attempts: List[Dict],  # [{"correct": bool, "topic": str}, ...]
        batch_id: str = "batch_1"
    ) -> Dict[str, MasteryEstimate]:
        """Compute mastery estimates for multiple topics in a batch.
        
        Args:
            attempts: List of attempt records with correctness and topic
            batch_id: Identifier for this batch of updates
        
        Returns:
            Dictionary mapping topic → MasteryEstimate
        """
        # Aggregate by topic
        topic_stats: Dict[str, Dict] = {}
        for attempt in attempts:
            topic = attempt.get("topic", "unknown")
            correct = attempt.get("correct", False)
            
            if topic not in topic_stats:
                topic_stats[topic] = {"correct": 0, "total": 0}
            
            topic_stats[topic]["total"] += 1
            if correct:
                topic_stats[topic]["correct"] += 1
        
        # Compute posterior for each topic
        results = {}
        for topic, stats in topic_stats.items():
            estimate = self.compute_posterior_analytical(
                stats["correct"],
                stats["total"]
            )
            estimate.topic = topic
            estimate.batch_id = batch_id
            results[topic] = estimate
        
        return results
    
    # ---------------------------------------------------------------------------
    # Static helper methods for Beta distribution
    # ---------------------------------------------------------------------------
    
    @staticmethod
    def _beta_quantile(p: float, alpha: float, beta: float) -> float:
        """Compute quantile of Beta(alpha, beta) distribution."""
        from scipy.stats import beta as beta_dist
        return beta_dist.ppf(p, alpha, beta)
    
    @staticmethod
    def _beta_cdf(x: float, alpha: float, beta: float) -> float:
        """Compute CDF of Beta(alpha, beta) distribution."""
        from scipy.stats import beta as beta_dist
        return beta_dist.cdf(x, alpha, beta)
    
    @staticmethod
    def _beta_pdf(x: float, alpha: float, beta: float) -> float:
        """Compute PDF of Beta(alpha, beta) distribution."""
        from scipy.stats import beta as beta_dist
        return beta_dist.pdf(x, alpha, beta)
