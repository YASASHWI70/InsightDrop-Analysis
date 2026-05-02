"""
Statistics Analyzer — Computes descriptive and distributional statistics
for all numeric columns in a dataset.
"""

import pandas as pd
import numpy as np
from scipy import stats


class StatisticsAnalyzer:
    """Generates detailed statistical summaries for numeric columns."""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.numeric_df = df.select_dtypes(include=np.number)

    def analyze(self) -> dict:
        """Run full statistical analysis."""
        if self.numeric_df.empty:
            return {
                "summary": [],
                "overall": {"message": "No numeric columns found in dataset."},
            }

        return {
            "summary": self._column_statistics(),
            "overall": self._overall_stats(),
        }

    def _column_statistics(self) -> list[dict]:
        """Compute detailed statistics per numeric column."""
        results = []
        for col in self.numeric_df.columns:
            series = self.numeric_df[col].dropna()
            if len(series) == 0:
                continue

            stat = {
                "column": col,
                "count": int(series.count()),
                "mean": self._safe(series.mean()),
                "median": self._safe(series.median()),
                "mode": self._safe(series.mode().iloc[0]) if len(series.mode()) > 0 else None,
                "std": self._safe(series.std()),
                "variance": self._safe(series.var()),
                "min": self._safe(series.min()),
                "max": self._safe(series.max()),
                "range": self._safe(series.max() - series.min()),
                "q1": self._safe(series.quantile(0.25)),
                "q2": self._safe(series.quantile(0.50)),
                "q3": self._safe(series.quantile(0.75)),
                "iqr": self._safe(
                    series.quantile(0.75) - series.quantile(0.25)
                ),
                "skewness": self._safe(series.skew()),
                "kurtosis": self._safe(series.kurtosis()),
                "cv": self._safe(
                    (series.std() / series.mean() * 100) if series.mean() != 0 else 0
                ),
            }

            # Distribution shape classification
            skew = series.skew()
            if abs(skew) < 0.5:
                stat["distribution_shape"] = "approximately symmetric"
            elif skew > 0:
                stat["distribution_shape"] = "right-skewed (positive)"
            else:
                stat["distribution_shape"] = "left-skewed (negative)"

            # Normality test (Shapiro-Wilk for small datasets, D'Agostino for large)
            if 8 <= len(series) <= 5000:
                try:
                    _, p_value = stats.shapiro(series.sample(min(len(series), 5000)))
                    stat["normality_test"] = {
                        "test": "Shapiro-Wilk",
                        "p_value": self._safe(p_value),
                        "is_normal": bool(p_value > 0.05),
                    }
                except Exception:
                    stat["normality_test"] = None
            elif len(series) > 5000:
                try:
                    _, p_value = stats.normaltest(series)
                    stat["normality_test"] = {
                        "test": "D'Agostino-Pearson",
                        "p_value": self._safe(p_value),
                        "is_normal": bool(p_value > 0.05),
                    }
                except Exception:
                    stat["normality_test"] = None
            else:
                stat["normality_test"] = None

            results.append(stat)
        return results

    def _overall_stats(self) -> dict:
        """High-level summary across all numeric columns."""
        most_variable = None
        if not self.numeric_df.empty:
            cvs = {}
            for col in self.numeric_df.columns:
                s = self.numeric_df[col].dropna()
                if len(s) > 0 and s.mean() != 0:
                    cvs[col] = abs(s.std() / s.mean())
            if cvs:
                most_variable = max(cvs, key=cvs.get)

        highly_skewed = [
            col
            for col in self.numeric_df.columns
            if abs(self.numeric_df[col].dropna().skew()) > 1
        ]

        return {
            "total_numeric_columns": len(self.numeric_df.columns),
            "most_variable_column": most_variable,
            "highly_skewed_columns": highly_skewed,
            "total_observations": int(self.df.shape[0]),
        }

    @staticmethod
    def _safe(val):
        """Convert to JSON-safe type."""
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return round(float(val), 4)
        if isinstance(val, (np.bool_,)):
            return bool(val)
        return val
