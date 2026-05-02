"""
Correlation Analyzer — Computes correlation matrices and identifies
strongly correlated feature pairs.
"""

import pandas as pd
import numpy as np


class CorrelationAnalyzer:
    """Analyzes correlations between numeric features in a DataFrame."""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.numeric_df = df.select_dtypes(include=np.number)

    def analyze(self) -> dict:
        """Run full correlation analysis."""
        if self.numeric_df.shape[1] < 2:
            return {
                "matrix": None,
                "strong_pairs": [],
                "message": "Need at least 2 numeric columns for correlation analysis.",
            }

        return {
            "matrix": self._correlation_matrix(),
            "strong_pairs": self._strong_correlations(threshold=0.5),
            "top_positive": self._top_correlations(n=5, positive=True),
            "top_negative": self._top_correlations(n=5, positive=False),
        }

    def _correlation_matrix(self) -> dict:
        """Return the full Pearson correlation matrix as a dict."""
        corr = self.numeric_df.corr(method="pearson")
        return {
            "columns": list(corr.columns),
            "values": [
                [self._safe(v) for v in row] for row in corr.values.tolist()
            ],
        }

    def _strong_correlations(self, threshold: float = 0.5) -> list[dict]:
        """Find column pairs with |correlation| >= threshold."""
        corr = self.numeric_df.corr()
        pairs = []
        seen = set()

        for i, col1 in enumerate(corr.columns):
            for j, col2 in enumerate(corr.columns):
                if i >= j:
                    continue
                val = corr.iloc[i, j]
                if abs(val) >= threshold and (col2, col1) not in seen:
                    seen.add((col1, col2))
                    strength = (
                        "very strong" if abs(val) >= 0.8 else
                        "strong" if abs(val) >= 0.6 else
                        "moderate"
                    )
                    pairs.append({
                        "column_1": col1,
                        "column_2": col2,
                        "correlation": self._safe(val),
                        "direction": "positive" if val > 0 else "negative",
                        "strength": strength,
                    })

        # Sort by absolute correlation descending
        pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return pairs

    def _top_correlations(self, n: int = 5, positive: bool = True) -> list[dict]:
        """Return the top N strongest positive or negative correlations."""
        corr = self.numeric_df.corr()
        pairs = []

        for i, col1 in enumerate(corr.columns):
            for j, col2 in enumerate(corr.columns):
                if i >= j:
                    continue
                val = corr.iloc[i, j]
                if (positive and val > 0) or (not positive and val < 0):
                    pairs.append({
                        "column_1": col1,
                        "column_2": col2,
                        "correlation": self._safe(val),
                    })

        pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return pairs[:n]

    @staticmethod
    def _safe(val):
        """Convert to JSON-safe type."""
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return round(float(val), 4)
        return val
