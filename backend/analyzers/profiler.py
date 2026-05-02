"""
Data Profiler — Generates a comprehensive profile of any dataset.
Covers shape, types, missing values, unique counts, memory usage, and data quality score.
"""

import pandas as pd
import numpy as np


class DataProfiler:
    """Analyzes a DataFrame and produces a detailed data profile."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def profile(self) -> dict:
        """Run full profiling and return results as a dictionary."""
        return {
            "overview": self._overview(),
            "columns": self._column_details(),
            "data_quality": self._data_quality(),
            "sample_data": self._sample_data(),
        }

    def _overview(self) -> dict:
        """High-level dataset overview."""
        return {
            "rows": int(self.df.shape[0]),
            "columns": int(self.df.shape[1]),
            "total_cells": int(self.df.shape[0] * self.df.shape[1]),
            "missing_cells": int(self.df.isnull().sum().sum()),
            "missing_percentage": round(
                self.df.isnull().sum().sum()
                / (self.df.shape[0] * self.df.shape[1])
                * 100,
                2,
            ),
            "duplicate_rows": int(self.df.duplicated().sum()),
            "duplicate_percentage": round(
                self.df.duplicated().sum() / self.df.shape[0] * 100, 2
            ),
            "memory_usage_mb": round(
                self.df.memory_usage(deep=True).sum() / (1024 * 1024), 4
            ),
            "numeric_columns": int(self.df.select_dtypes(include=np.number).shape[1]),
            "categorical_columns": int(
                self.df.select_dtypes(include=["object", "category"]).shape[1]
            ),
            "datetime_columns": int(
                self.df.select_dtypes(include=["datetime64"]).shape[1]
            ),
        }

    def _column_details(self) -> list[dict]:
        """Per-column profiling details."""
        details = []
        for col in self.df.columns:
            series = self.df[col]
            info = {
                "name": col,
                "dtype": str(series.dtype),
                "count": int(series.count()),
                "missing": int(series.isnull().sum()),
                "missing_pct": round(series.isnull().sum() / len(series) * 100, 2),
                "unique": int(series.nunique()),
                "unique_pct": round(series.nunique() / len(series) * 100, 2),
            }

            # Add type-specific details
            if pd.api.types.is_numeric_dtype(series):
                info["category"] = "numeric"
                info["zeros"] = int((series == 0).sum())
                info["negatives"] = int((series < 0).sum())
                info["min"] = self._safe_value(series.min())
                info["max"] = self._safe_value(series.max())
                info["mean"] = self._safe_value(series.mean())
            elif pd.api.types.is_object_dtype(series) or isinstance(series.dtype, pd.CategoricalDtype):
                info["category"] = "categorical"
                top_values = series.value_counts().head(5)
                info["top_values"] = [
                    {"value": str(v), "count": int(c)}
                    for v, c in top_values.items()
                ]
                info["avg_length"] = round(
                    series.dropna().astype(str).str.len().mean(), 1
                ) if len(series.dropna()) > 0 else 0
            elif pd.api.types.is_datetime64_any_dtype(series):
                info["category"] = "datetime"
                info["min"] = str(series.min())
                info["max"] = str(series.max())
                info["range_days"] = (series.max() - series.min()).days if series.count() > 0 else 0
            else:
                info["category"] = "other"

            details.append(info)
        return details

    def _data_quality(self) -> dict:
        """Calculate overall data quality score (0-100)."""
        total = self.df.shape[0] * self.df.shape[1]
        if total == 0:
            return {"score": 0, "grade": "N/A", "issues": []}

        issues = []

        # Completeness (40% weight)
        completeness = 1 - (self.df.isnull().sum().sum() / total)
        if completeness < 1:
            issues.append(
                f"{self.df.isnull().sum().sum()} missing values detected "
                f"({round((1 - completeness) * 100, 1)}%)"
            )

        # Uniqueness — check for duplicate rows (20% weight)
        dup_ratio = self.df.duplicated().sum() / self.df.shape[0]
        uniqueness = 1 - dup_ratio
        if dup_ratio > 0:
            issues.append(
                f"{self.df.duplicated().sum()} duplicate rows "
                f"({round(dup_ratio * 100, 1)}%)"
            )

        # Consistency — check for mixed types in object columns (20% weight)
        mixed_type_cols = 0
        for col in self.df.select_dtypes(include=["object"]).columns:
            types = self.df[col].dropna().apply(type).nunique()
            if types > 1:
                mixed_type_cols += 1
        obj_cols = len(self.df.select_dtypes(include=["object"]).columns)
        consistency = 1 - (mixed_type_cols / obj_cols) if obj_cols > 0 else 1
        if mixed_type_cols > 0:
            issues.append(f"{mixed_type_cols} columns with mixed data types")

        # Column variety (20% weight) — penalize single-value columns
        constant_cols = sum(1 for col in self.df.columns if self.df[col].nunique() <= 1)
        variety = 1 - (constant_cols / self.df.shape[1]) if self.df.shape[1] > 0 else 1
        if constant_cols > 0:
            issues.append(f"{constant_cols} constant (single-value) columns")

        score = round(
            (completeness * 40 + uniqueness * 20 + consistency * 20 + variety * 20), 1
        )

        grade = (
            "A+" if score >= 95 else
            "A" if score >= 90 else
            "B" if score >= 80 else
            "C" if score >= 70 else
            "D" if score >= 60 else
            "F"
        )

        return {
            "score": score,
            "grade": grade,
            "completeness": round(completeness * 100, 1),
            "uniqueness": round(uniqueness * 100, 1),
            "consistency": round(consistency * 100, 1),
            "variety": round(variety * 100, 1),
            "issues": issues,
        }

    def _sample_data(self) -> dict:
        """Return head and tail samples for preview."""
        head = self.df.head(10).fillna("null")
        # Convert all values to native Python types for JSON serialization
        return {
            "columns": list(self.df.columns),
            "head": [
                [self._safe_value(v) for v in row]
                for row in head.values.tolist()
            ],
        }

    @staticmethod
    def _safe_value(val):
        """Convert numpy/pandas types to JSON-safe Python types."""
        if pd.isna(val):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return round(float(val), 4) if not np.isinf(val) else None
        if isinstance(val, (np.bool_,)):
            return bool(val)
        return str(val) if not isinstance(val, (int, float, bool, str)) else val
