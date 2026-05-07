"""
Target Variable Analyzer — Analyzes a chosen target column.

Sections returned:
  stat_cards      — quick snapshot (type, valid, missing, mean/median/std or unique/top)
  problem_type    — auto-detected ML problem type with reason and imbalance note
  recommended_algorithms — suggestions derived from dataset characteristics
  class_distribution — chart data (classification targets only)
  correlations    — Pearson r bar (numeric target) or group-means table (categorical)
  distribution    — histogram data (numeric) or top-values bar data (categorical)
"""

import pandas as pd
import numpy as np


class TargetAnalyzer:
    """Analyzes a target variable within a DataFrame."""

    def __init__(self, df: pd.DataFrame, target_col: str):
        self.df = df
        self.target_col = target_col

    def analyze(self) -> dict:
        df = self.df
        target_col = self.target_col

        if target_col not in df.columns:
            return {"error": f"Column '{target_col}' not found in dataset."}

        tc = df[target_col]
        n_total = len(tc)
        n_missing = int(tc.isna().sum())
        n_valid = n_total - n_missing
        miss_pct = round(n_missing / n_total * 100, 2) if n_total else 0.0
        n_unique = int(tc.nunique())
        sem_type = self._semantic_type(tc)
        is_num = sem_type in ("Continuous", "Discrete", "Ordinal")

        num_cols = df.select_dtypes(include="number").columns.tolist()

        # Dataset-level signals for algorithm recommendation
        n_rows = len(df)
        n_features = max(len(df.columns) - 1, 1)
        n_numeric = len(df.select_dtypes(include="number").columns)
        n_categ = len(df.select_dtypes(include="object").columns)
        miss_pct_overall = float(df.isnull().mean().mean() * 100)

        majority_pct: float | None = None
        if n_valid > 0 and not is_num and sem_type != "Datetime":
            majority_pct = round(tc.value_counts().iloc[0] / n_valid * 100, 2)

        prob_type, prob_color, prob_reason, prob_note = self._detect_problem_type(
            tc, sem_type, n_unique, n_valid, is_num
        )

        algos = self._recommend_algorithms(
            prob_type=prob_type,
            n_rows=n_rows,
            n_features=n_features,
            missing_pct=miss_pct_overall,
            n_numeric=n_numeric,
            n_categorical=n_categ,
            majority_pct=majority_pct,
            n_target_classes=n_unique if prob_type in ("Binary Classification", "Multiclass Classification") else None,
        )

        return {
            "target_col": target_col,
            "stat_cards": self._stat_cards(tc, sem_type, is_num, n_valid, n_missing, miss_pct, n_unique),
            "problem_type": {
                "label": prob_type,
                "color": prob_color,
                "reason": prob_reason,
                "note": prob_note,
            },
            "recommended_algorithms": algos,
            "class_distribution": self._class_distribution(tc, prob_type, n_valid, n_unique) if prob_type in ("Binary Classification", "Multiclass Classification") else None,
            "correlations": self._correlations(df, tc, target_col, num_cols, is_num, sem_type),
            "distribution": self._distribution(tc, target_col, is_num, n_valid),
        }

    # ── helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _semantic_type(col: pd.Series) -> str:
        nu = col.nunique()
        if col.dtype == object:
            try:
                if pd.to_datetime(col.dropna().head(200), errors="coerce").notna().mean() > 0.5:
                    return "Datetime"
            except Exception:
                pass
        if pd.api.types.is_bool_dtype(col):
            return "Categorical"
        if pd.api.types.is_float_dtype(col):
            return "Continuous"
        if pd.api.types.is_integer_dtype(col):
            return "Ordinal" if nu <= 20 else "Discrete"
        if col.dtype == object:
            return "Categorical" if nu <= 50 else "Text"
        return "Other"

    @staticmethod
    def _safe(val):
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        if isinstance(val, (np.integer,)):
            return int(val)
        if isinstance(val, (np.floating,)):
            return round(float(val), 4)
        return val

    def _stat_cards(self, tc, sem_type, is_num, n_valid, n_missing, miss_pct, n_unique) -> list[dict]:
        cards = [
            {"label": "Type", "value": sem_type, "sub": str(tc.dtype)},
            {"label": "Valid", "value": f"{n_valid:,}", "sub": f"{100 - miss_pct:.1f}% complete"},
            {"label": "Missing", "value": f"{n_missing:,}", "sub": f"{miss_pct:.1f}%"},
        ]
        if is_num:
            clean = tc.dropna()
            cards += [
                {"label": "Mean", "value": self._safe(clean.mean()), "sub": None},
                {"label": "Median", "value": self._safe(clean.median()), "sub": None},
                {"label": "Std Dev", "value": self._safe(clean.std()), "sub": None},
                {"label": "Range", "value": f"{self._safe(clean.min())} – {self._safe(clean.max())}", "sub": None},
                {"label": "Skew", "value": self._safe(round(clean.skew(), 3)), "sub": None},
            ]
        else:
            top_val = tc.value_counts().index[0] if n_valid > 0 else "—"
            top_count = int(tc.value_counts().iloc[0]) if n_valid > 0 else 0
            top_pct = round(top_count / n_valid * 100, 1) if n_valid > 0 else 0
            cards += [
                {"label": "Unique", "value": f"{n_unique:,}", "sub": None},
                {"label": "Most Common", "value": str(top_val)[:24], "sub": f"{top_count:,} rows · {top_pct:.1f}%"},
            ]
        return cards

    @staticmethod
    def _detect_problem_type(tc, sem_type, n_unique, n_valid, is_num):
        prob_note = None
        if sem_type == "Datetime":
            return (
                "Time Series / Forecasting", "#34D399",
                "Target is a datetime column — typically used for forecasting future values.",
                None,
            )
        if n_unique == 2:
            vc = tc.value_counts()
            majority_pct = vc.iloc[0] / n_valid * 100 if n_valid else 0
            prob_note = (
                f"Class imbalance detected — majority class is {majority_pct:.1f}%. "
                "Consider oversampling (SMOTE) or class weights."
                if majority_pct > 75 else None
            )
            return ("Binary Classification", "#3B82F6",
                    "Target has exactly 2 unique values — predicts one of two outcomes.",
                    prob_note)
        if is_num or (sem_type in ("Discrete", "Ordinal") and n_unique > 20):
            return (
                "Regression", "#06B6D4",
                f"Target is numeric with {n_unique:,} unique values — predicts a continuous quantity.",
                None,
            )
        vc = tc.value_counts()
        majority_pct = vc.iloc[0] / n_valid * 100 if n_valid else 0
        prob_note = (
            f"Class imbalance detected — top class is {majority_pct:.1f}% of data. "
            "Consider oversampling or balanced class weights."
            if majority_pct > 60 else None
        )
        return (
            "Multiclass Classification", "#F59E0B",
            f"Target has {n_unique} unique categories — predicts one of multiple classes.",
            prob_note,
        )

    @staticmethod
    def _recommend_algorithms(
        prob_type: str,
        n_rows: int,
        n_features: int,
        missing_pct: float,
        n_numeric: int,
        n_categorical: int,
        majority_pct: float | None = None,
        n_target_classes: int | None = None,
    ) -> list[dict]:
        recs: list[dict] = []
        is_large = n_rows > 50_000
        is_medium = 5_000 <= n_rows <= 50_000
        is_small = n_rows < 5_000
        is_wide = n_features >= 50
        has_missing = missing_pct > 0
        imbalanced = majority_pct is not None and majority_pct > 50

        if prob_type == "Regression":
            if is_small and not is_wide:
                recs.append({"name": "Linear Regression",
                             "reason": f"Small dataset ({n_rows:,} rows) — fast, interpretable baseline"})
            if is_wide or n_numeric > 20:
                recs.append({"name": "Ridge / Lasso",
                             "reason": f"{n_features} features — L1/L2 regularisation reduces overfitting"})
            elif not is_wide and n_numeric <= 20 and not is_small:
                recs.append({"name": "Decision Tree / Random Forest Regressor",
                             "reason": f"{n_features} features — tree models handle mixed types without scaling"})
            if not is_large:
                recs.append({"name": "Random Forest Regressor",
                             "reason": "Handles non-linearity and mixed feature types without scaling"})
            if is_medium or is_large:
                recs.append({"name": "XGBoost Regressor",
                             "reason": f"High accuracy on {'large' if is_large else 'medium'} datasets ({n_rows:,} rows)"})
            if has_missing:
                recs.append({"name": "LightGBM Regressor",
                             "reason": f"{missing_pct:.1f}% missing — handles NaNs natively"})
            elif is_large:
                recs.append({"name": "LightGBM Regressor",
                             "reason": f"Fastest gradient boosting for large datasets ({n_rows:,} rows)"})

        elif prob_type == "Binary Classification":
            if is_small:
                recs.append({"name": "Logistic Regression",
                             "reason": f"Small dataset ({n_rows:,} rows) — interpretable and low overfit risk"})
                recs.append({"name": "SVM (RBF kernel)",
                             "reason": "Effective on small datasets with complex decision boundaries"})
            if not is_wide and n_numeric <= 20 and not is_small:
                recs.append({"name": "Gradient Boosting (GBM)",
                             "reason": f"{n_features} features, {n_rows:,} rows — good fit for moderate-width structured data"})
            if imbalanced:
                recs.append({"name": "XGBoost (scale_pos_weight)",
                             "reason": f"Class imbalance ({majority_pct:.1f}% majority) — use scale_pos_weight parameter"})
                recs.append({"name": "Balanced Random Forest",
                             "reason": f"Built-in class balancing for imbalanced data ({majority_pct:.1f}% majority)"})
            else:
                recs.append({"name": "Random Forest",
                             "reason": "Robust to outliers; no scaling required for mixed feature types"})
                if is_medium or is_large:
                    recs.append({"name": "XGBoost",
                                 "reason": f"High performance on {'large' if is_large else 'medium'} datasets ({n_rows:,} rows)"})
            if is_large:
                recs.append({"name": "LightGBM",
                             "reason": f"Memory-efficient gradient boosting for {n_rows:,} rows"})
            if has_missing:
                recs.append({"name": "XGBoost / LightGBM",
                             "reason": f"{missing_pct:.1f}% missing — both handle NaNs natively"})

        elif prob_type == "Multiclass Classification":
            n_cls = n_target_classes or 3
            if is_small:
                recs.append({"name": "Multinomial Logistic Regression",
                             "reason": f"Small dataset ({n_rows:,} rows) — stable, interpretable baseline"})
            if not is_wide and n_numeric <= 20 and not is_small:
                recs.append({"name": "Random Forest",
                             "reason": f"{n_features} features — narrow, structured data suits ensemble trees well"})
            if n_cls <= 10:
                recs.append({"name": "Random Forest",
                             "reason": f"{n_cls} classes — ensemble voting handles multi-class naturally"})
                recs.append({"name": "XGBoost (multi:softmax)",
                             "reason": f"{n_cls} classes — native multiclass support with strong accuracy"})
            else:
                recs.append({"name": "XGBoost (multi:softprob)",
                             "reason": f"High cardinality target ({n_cls} classes) — probabilistic output per class"})
                recs.append({"name": "Neural Network (MLP)",
                             "reason": f"Many classes ({n_cls}) — shared representations scale better"})
            if imbalanced:
                recs.append({"name": "Balanced Random Forest",
                             "reason": f"Top class is {majority_pct:.1f}% — built-in class weight balancing"})
            if is_large:
                recs.append({"name": "LightGBM",
                             "reason": f"Fast training for {n_rows:,} rows × {n_cls} classes"})
            if has_missing:
                recs.append({"name": "XGBoost / LightGBM",
                             "reason": f"{missing_pct:.1f}% missing — handle NaNs natively"})

        elif prob_type == "Time Series / Forecasting":
            recs.append({"name": "ARIMA / SARIMA",
                         "reason": "Classical baseline — suitable for stationary or seasonal series"})
            if is_medium or is_large:
                recs.append({"name": "Prophet",
                             "reason": f"{n_rows:,} observations — automatic seasonality and holiday handling"})
                recs.append({"name": "XGBoost (lag features)",
                             "reason": "Converts time series to supervised learning via engineered lag features"})
            if is_large:
                recs.append({"name": "LSTM / Transformer",
                             "reason": f"Deep learning for {n_rows:,} timesteps — captures long-range dependencies"})
            if n_features > 1:
                recs.append({"name": "Vector AutoRegression (VAR)",
                             "reason": f"{n_features} features — models cross-series interdependencies"})

        # Deduplicate while preserving insertion order
        seen: set[str] = set()
        unique_recs: list[dict] = []
        for r in recs:
            if r["name"] not in seen:
                seen.add(r["name"])
                unique_recs.append(r)
        return unique_recs

    def _class_distribution(self, tc, prob_type, n_valid, n_unique) -> dict:
        vc = tc.value_counts()
        top_show = vc.head(20)
        labels = top_show.index.astype(str).tolist()
        counts = [int(v) for v in top_show.values.tolist()]
        pcts = [round(v / n_valid * 100, 1) if n_valid else 0 for v in counts]
        return {
            "labels": labels,
            "counts": counts,
            "percentages": pcts,
            "total_classes": n_unique,
            "truncated": n_unique > 20,
        }

    def _correlations(self, df, tc, target_col, num_cols, is_num, sem_type) -> dict:
        if is_num:
            other_num = [c for c in num_cols if c != target_col]
            if not other_num:
                return {"type": "pearson", "data": [], "message": "No other numeric columns to correlate."}
            corr_series = (
                df[other_num + [target_col]]
                .corr()[target_col]
                .drop(target_col)
                .dropna()
            )
            corr_series = corr_series.reindex(corr_series.abs().sort_values(ascending=True).index)
            return {
                "type": "pearson",
                "columns": corr_series.index.tolist(),
                "values": [round(float(v), 4) for v in corr_series.values],
                "message": None,
            }
        else:
            if not num_cols:
                return {"type": "group_means", "data": None, "message": "No numeric columns available to compare across target groups."}
            TOP_N = 20
            n_cats = int(tc.nunique())
            top_cats = tc.value_counts().head(TOP_N).index.tolist()
            filtered_df = df[df[target_col].isin(top_cats)]
            group_means = (
                filtered_df.groupby(target_col)[num_cols]
                .mean()
                .round(3)
                .loc[[c for c in top_cats if c in filtered_df[target_col].unique()]]
            )
            return {
                "type": "group_means",
                "categories": group_means.index.astype(str).tolist(),
                "columns": num_cols,
                "values": [[self._safe(v) for v in row] for row in group_means.values.tolist()],
                "total_categories": n_cats,
                "truncated": n_cats > TOP_N,
                "message": None,
            }

    def _distribution(self, tc, target_col, is_num, n_valid) -> dict:
        if is_num:
            clean = tc.dropna()
            counts, bin_edges = np.histogram(clean, bins=40)
            bin_midpoints = [round(float((bin_edges[i] + bin_edges[i + 1]) / 2), 4)
                             for i in range(len(bin_edges) - 1)]
            return {
                "type": "histogram",
                "x": bin_midpoints,
                "counts": [int(c) for c in counts],
                "mean": self._safe(clean.mean()),
                "median": self._safe(clean.median()),
            }
        else:
            vc = tc.value_counts().head(20)
            labels = vc.index.astype(str).tolist()
            counts = [int(v) for v in vc.values]
            pcts = [round(v / n_valid * 100, 1) if n_valid else 0 for v in counts]
            return {
                "type": "bar",
                "labels": labels,
                "counts": counts,
                "percentages": pcts,
            }
