"""
Visualization Generator — Produces chart-ready data for Plotly.js rendering.
"""

import pandas as pd
import numpy as np


class VisualizationGenerator:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.numeric_df = df.select_dtypes(include=np.number)
        self.categorical_df = df.select_dtypes(include=["object", "category"])

    def generate(self) -> dict:
        charts = []
        charts.extend(self._histograms())
        charts.extend(self._box_plots())
        charts.extend(self._bar_charts())
        if self.numeric_df.shape[1] >= 2:
            charts.append(self._correlation_heatmap())
            charts.extend(self._scatter_plots())
        charts.append(self._missing_values_chart())
        charts.append(self._dtype_distribution())
        return {"charts": charts}

    def _histograms(self) -> list[dict]:
        charts = []
        for col in self.numeric_df.columns[:10]:
            s = self.numeric_df[col].dropna()
            if len(s) == 0:
                continue
            charts.append({
                "id": f"hist_{col}", "type": "histogram",
                "title": f"Distribution of {col}",
                "data": [{"x": [self._s(v) for v in s.tolist()], "type": "histogram",
                          "marker": {"color": "rgba(99, 102, 241, 0.7)"}, "name": col}],
                "layout": {"xaxis": {"title": col}, "yaxis": {"title": "Count"}},
            })
        return charts

    def _box_plots(self) -> list[dict]:
        if self.numeric_df.empty:
            return []
        cols = list(self.numeric_df.columns[:8])
        data = []
        colors = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#818cf8","#6d28d9","#7c3aed","#4f46e5"]
        for i, col in enumerate(cols):
            s = self.numeric_df[col].dropna()
            data.append({"y": [self._s(v) for v in s.tolist()], "type": "box",
                         "name": col, "marker": {"color": colors[i % len(colors)]}})
        return [{"id": "boxplots", "type": "box", "title": "Box Plots — Numeric Columns",
                 "data": data, "layout": {"yaxis": {"title": "Values"}}}]

    def _bar_charts(self) -> list[dict]:
        charts = []
        for col in self.categorical_df.columns[:5]:
            vc = self.df[col].value_counts().head(15)
            charts.append({
                "id": f"bar_{col}", "type": "bar",
                "title": f"Top Values — {col}",
                "data": [{"x": [str(v) for v in vc.index.tolist()],
                          "y": [int(v) for v in vc.values.tolist()],
                          "type": "bar", "marker": {"color": "rgba(139, 92, 246, 0.8)"}}],
                "layout": {"xaxis": {"title": col}, "yaxis": {"title": "Count"}},
            })
        return charts

    def _correlation_heatmap(self) -> dict:
        corr = self.numeric_df.corr()
        cols = list(corr.columns)
        vals = [[self._s(v) for v in row] for row in corr.values.tolist()]
        return {
            "id": "corr_heatmap", "type": "heatmap",
            "title": "Correlation Heatmap",
            "data": [{"z": vals, "x": cols, "y": cols, "type": "heatmap",
                      "colorscale": "RdBu", "reversescale": True, "zmin": -1, "zmax": 1}],
            "layout": {"height": 500},
        }

    def _scatter_plots(self) -> list[dict]:
        charts = []
        cols = list(self.numeric_df.columns)
        pairs = []
        corr = self.numeric_df.corr()
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                pairs.append((cols[i], cols[j], abs(corr.iloc[i, j])))
        pairs.sort(key=lambda x: x[2], reverse=True)
        for c1, c2, _ in pairs[:3]:
            s1 = self.df[c1].dropna()
            s2 = self.df[c2].dropna()
            idx = s1.index.intersection(s2.index)
            charts.append({
                "id": f"scatter_{c1}_{c2}", "type": "scatter",
                "title": f"{c1} vs {c2}",
                "data": [{"x": [self._s(v) for v in s1.loc[idx].head(500).tolist()],
                          "y": [self._s(v) for v in s2.loc[idx].head(500).tolist()],
                          "mode": "markers", "type": "scatter",
                          "marker": {"color": "rgba(99,102,241,0.5)", "size": 5}}],
                "layout": {"xaxis": {"title": c1}, "yaxis": {"title": c2}},
            })
        return charts

    def _missing_values_chart(self) -> dict:
        missing = self.df.isnull().sum()
        missing = missing[missing > 0].sort_values(ascending=True)
        if len(missing) == 0:
            return {"id": "missing", "type": "info", "title": "Missing Values",
                    "message": "No missing values found! ✅"}
        return {
            "id": "missing", "type": "bar", "title": "Missing Values by Column",
            "data": [{"x": [int(v) for v in missing.values.tolist()],
                      "y": list(missing.index), "type": "bar", "orientation": "h",
                      "marker": {"color": "rgba(239, 68, 68, 0.7)"}}],
            "layout": {"xaxis": {"title": "Missing Count"}, "margin": {"l": 150}},
        }

    def _dtype_distribution(self) -> dict:
        counts = self.df.dtypes.astype(str).value_counts()
        return {
            "id": "dtypes", "type": "pie", "title": "Data Types Distribution",
            "data": [{"values": [int(v) for v in counts.values.tolist()],
                      "labels": list(counts.index), "type": "pie",
                      "marker": {"colors": ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981"]}}],
            "layout": {},
        }

    @staticmethod
    def _s(val):
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        if isinstance(val, (np.integer,)): return int(val)
        if isinstance(val, (np.floating,)): return round(float(val), 4)
        return val
