/**
 * Auto-Data Analyzer — Frontend Application
 * Handles file upload, API communication, and dashboard rendering.
 */

const API = '';
let analysisData = null;

// ===== DOM ELEMENTS =====
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const uploadSection = document.getElementById('upload-section');
const resultsSection = document.getElementById('results-section');
const uploadProgress = document.getElementById('upload-progress');
const loadingOverlay = document.getElementById('loading-overlay');
const newUploadBtn = document.getElementById('new-upload-btn');
const tabNav = document.getElementById('tab-nav');

// ===== INIT =====
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupUpload();
    setupTabs();
    newUploadBtn.addEventListener('click', resetToUpload);
}

// ===== FILE UPLOAD =====
function setupUpload() {
    // Click to browse
    browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
}

async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Please upload a CSV or Excel file.');
        return;
    }

    // Show progress
    uploadProgress.classList.remove('hidden');

    try {
        // Step 1: Upload
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).detail || 'Upload failed');
        const uploadData = await uploadRes.json();

        // Step 2: Analyze
        uploadProgress.querySelector('.progress-text').textContent = 'Running full analysis...';
        loadingOverlay.classList.remove('hidden');

        const analyzeRes = await fetch(`${API}/api/analyze/${uploadData.dataset_id}`);
        if (!analyzeRes.ok) throw new Error('Analysis failed');
        analysisData = await analyzeRes.json();

        // Step 3: Render
        renderDashboard(analysisData);

        // Show results
        uploadSection.classList.remove('visible');
        uploadSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('visible');
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        uploadProgress.classList.add('hidden');
        loadingOverlay.classList.add('hidden');
        fileInput.value = '';
    }
}

function resetToUpload() {
    resultsSection.classList.remove('visible');
    resultsSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    uploadSection.classList.add('visible');
    analysisData = null;
}

// ===== TAB NAVIGATION =====
function setupTabs() {
    tabNav.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab')) return;
        tabNav.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${e.target.dataset.tab}`).classList.add('active');
    });
}

// ===== RENDER DASHBOARD =====
function renderDashboard(data) {
    document.getElementById('file-name').textContent = data.filename;
    document.getElementById('file-meta').textContent =
        `— ${fmt(data.profile.overview.rows)} rows × ${data.profile.overview.columns} columns`;

    renderOverview(data.profile);
    renderStatistics(data.statistics);
    renderCorrelations(data.correlations);
    renderOutliers(data.outliers);
    renderVisualizations(data.visualizations);
    renderDataPreview(data.profile.sample_data);
}

// ===== OVERVIEW PANEL =====
function renderOverview(profile) {
    const o = profile.overview;
    const q = profile.data_quality;

    // Metric cards
    document.getElementById('overview-cards').innerHTML = [
        metricCard('Total Rows', fmt(o.rows), 'records'),
        metricCard('Total Columns', o.columns, `${o.numeric_columns} numeric, ${o.categorical_columns} categorical`),
        metricCard('Missing Cells', fmt(o.missing_cells), `${o.missing_percentage}% of all data`),
        metricCard('Duplicate Rows', fmt(o.duplicate_rows), `${o.duplicate_percentage}%`),
    ].join('');

    // Quality score ring
    const pct = q.score;
    const circumference = 2 * Math.PI * 48;
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    document.getElementById('quality-card').innerHTML = `
        <p class="card-title">Data Quality Score</p>
        <div class="quality-ring">
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" stroke-width="6"/>
                <circle cx="60" cy="60" r="48" fill="none" stroke="${color}" stroke-width="6"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" style="transition: stroke-dashoffset 1s ease"/>
            </svg>
            <div class="score-text">
                <span class="score-value" style="color:${color}">${pct}</span>
                <span class="score-grade">Grade ${q.grade}</span>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.8rem;color:var(--text-secondary)">
            <span>Completeness: ${q.completeness}%</span>
            <span>Uniqueness: ${q.uniqueness}%</span>
            <span>Consistency: ${q.consistency}%</span>
            <span>Variety: ${q.variety}%</span>
        </div>
        ${q.issues.length ? `<ul class="issue-list" style="margin-top:0.75rem">${q.issues.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
    `;

    // Column types chart
    const el = document.getElementById('column-types-card');
    el.innerHTML = `<p class="card-title">Column Types</p><div id="dtype-chart" style="height:200px"></div>`;
    const cats = { numeric: o.numeric_columns, categorical: o.categorical_columns, datetime: o.datetime_columns };
    Plotly.newPlot('dtype-chart', [{
        values: Object.values(cats), labels: Object.keys(cats), type: 'pie', hole: 0.55,
        marker: { colors: ['#6366f1', '#8b5cf6', '#ec4899'] },
        textinfo: 'label+value', textfont: { color: '#e8e8f0', size: 12 },
    }], plotlyLayout(180), { responsive: true, displayModeBar: false });

    // Columns detail table
    const cols = profile.columns;
    document.getElementById('columns-table-card').innerHTML = `
        <p class="card-title">Column Details</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Category</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>${cols.map(c => `<tr>
                <td style="font-weight:600">${c.name}</td>
                <td><span class="badge badge-info">${c.dtype}</span></td>
                <td>${c.category || '-'}</td>
                <td>${c.missing} <span style="color:var(--text-muted)">(${c.missing_pct}%)</span></td>
                <td>${c.unique}</td>
                <td>${c.min ?? '-'}</td>
                <td>${c.max ?? '-'}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
}

// ===== STATISTICS PANEL =====
function renderStatistics(stats) {
    const ov = stats.overall;
    document.getElementById('stats-overall').innerHTML = [
        metricCard('Numeric Columns', ov.total_numeric_columns, ''),
        metricCard('Most Variable', ov.most_variable_column || 'N/A', 'highest coefficient of variation'),
        metricCard('Highly Skewed', ov.highly_skewed_columns?.length || 0, 'columns with |skew| > 1'),
    ].join('');

    if (!stats.summary.length) {
        document.getElementById('stats-table-card').innerHTML = '<div class="info-message">No numeric columns to analyze.</div>';
        return;
    }

    const fields = ['column','count','mean','median','std','min','max','q1','q3','skewness','kurtosis','distribution_shape'];
    document.getElementById('stats-table-card').innerHTML = `
        <p class="card-title">Descriptive Statistics</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${fields.map(f => `<th>${f.replace('_',' ')}</th>`).join('')}</tr></thead>
            <tbody>${stats.summary.map(s => `<tr>${fields.map(f => {
                let v = s[f];
                if (typeof v === 'number' && f !== 'count') v = v.toLocaleString(undefined, {maximumFractionDigits: 4});
                if (f === 'column') return `<td style="font-weight:600">${v}</td>`;
                if (f === 'distribution_shape') return `<td><span class="badge badge-info">${v}</span></td>`;
                return `<td>${v ?? '-'}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
}

// ===== CORRELATIONS PANEL =====
function renderCorrelations(corr) {
    if (corr.matrix === null) {
        document.getElementById('corr-heatmap-card').innerHTML = `<div class="info-message">${corr.message}</div>`;
        document.getElementById('corr-strong-card').innerHTML = '';
        document.getElementById('corr-top-card').innerHTML = '';
        return;
    }

    // Heatmap
    const hm = document.getElementById('corr-heatmap-card');
    hm.innerHTML = `<p class="card-title">Correlation Heatmap</p><div id="corr-heatmap" style="height:450px"></div>`;
    const m = corr.matrix;
    Plotly.newPlot('corr-heatmap', [{
        z: m.values, x: m.columns, y: m.columns, type: 'heatmap',
        colorscale: 'RdBu', reversescale: true, zmin: -1, zmax: 1,
        text: m.values.map(r => r.map(v => v !== null ? v.toFixed(2) : '')),
        texttemplate: '%{text}', textfont: { size: 10 },
    }], { ...plotlyLayout(420), margin: { l: 100, r: 40, t: 20, b: 100 } },
    { responsive: true, displayModeBar: false });

    // Strong pairs
    const sp = corr.strong_pairs || [];
    document.getElementById('corr-strong-card').innerHTML = `
        <p class="card-title">Strong Correlations (|r| ≥ 0.5)</p>
        ${sp.length === 0 ? '<div class="info-message">No strong correlations found.</div>' :
        sp.slice(0, 10).map(p => `<div class="pair-item">
            <span class="pair-cols">${p.column_1} ↔ ${p.column_2}</span>
            <span class="pair-val" style="color:${p.correlation > 0 ? 'var(--success)' : 'var(--danger)'}">${p.correlation.toFixed(4)}</span>
        </div>`).join('')}`;

    // Top positive
    const tp = corr.top_positive || [];
    document.getElementById('corr-top-card').innerHTML = `
        <p class="card-title">Top Positive Correlations</p>
        ${tp.length === 0 ? '<div class="info-message">None found.</div>' :
        tp.map(p => `<div class="pair-item">
            <span class="pair-cols">${p.column_1} ↔ ${p.column_2}</span>
            <span class="pair-val" style="color:var(--success)">${p.correlation.toFixed(4)}</span>
        </div>`).join('')}`;
}

// ===== OUTLIERS PANEL =====
function renderOutliers(outliers) {
    const s = outliers.summary;
    document.getElementById('outlier-summary-cards').innerHTML = [
        metricCard('Total Outliers', fmt(outliers.total_outliers), `across ${s.columns_with_outliers} columns`),
        metricCard('Clean Columns', s.columns_without_outliers, 'no outliers detected'),
        metricCard('High Severity', s.high_severity_columns?.length || 0, s.recommendation?.slice(0, 50) || ''),
    ].join('');

    if (!outliers.columns.length) {
        document.getElementById('outlier-table-card').innerHTML = '<div class="info-message">No numeric columns.</div>';
        return;
    }

    document.getElementById('outlier-table-card').innerHTML = `
        <p class="card-title">Outlier Detection (IQR Method)</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Column</th><th>Outliers</th><th>%</th><th>Lower Bound</th><th>Upper Bound</th><th>IQR</th><th>Severity</th></tr></thead>
            <tbody>${outliers.columns.map(c => {
                const sevClass = c.severity === 'high' ? 'danger' : c.severity === 'medium' ? 'warning' : 'success';
                return `<tr>
                    <td style="font-weight:600">${c.column}</td>
                    <td>${c.outlier_count}</td>
                    <td>${c.outlier_percentage}%</td>
                    <td>${c.bounds.lower ?? '-'}</td>
                    <td>${c.bounds.upper ?? '-'}</td>
                    <td>${c.iqr ?? '-'}</td>
                    <td><span class="badge badge-${sevClass}">${c.severity}</span></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
}

// ===== VISUALIZATIONS PANEL =====
function renderVisualizations(viz) {
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    if (!viz.charts || viz.charts.length === 0) {
        container.innerHTML = '<div class="info-message">No charts to display.</div>';
        return;
    }

    viz.charts.forEach((chart, i) => {
        if (chart.type === 'info') {
            container.innerHTML += `<div class="chart-card"><div class="chart-card-title">${chart.title}</div><div class="info-message">${chart.message}</div></div>`;
            return;
        }

        const isWide = ['heatmap', 'box'].includes(chart.type);
        const div = document.createElement('div');
        div.className = `chart-card${isWide ? ' full-width' : ''}`;
        div.innerHTML = `<div class="chart-card-title">${chart.title}</div><div class="chart-container" id="chart-${i}"></div>`;
        container.appendChild(div);

        const layout = { ...plotlyLayout(300), ...(chart.layout || {}) };
        setTimeout(() => {
            Plotly.newPlot(`chart-${i}`, chart.data, layout, { responsive: true, displayModeBar: false });
        }, 50);
    });
}

// ===== DATA PREVIEW PANEL =====
function renderDataPreview(sample) {
    if (!sample) {
        document.getElementById('data-table-card').innerHTML = '<div class="info-message">No preview available.</div>';
        return;
    }
    document.getElementById('data-table-card').innerHTML = `
        <p class="card-title">Data Preview (First 10 Rows)</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${sample.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${sample.head.map(row => `<tr>${row.map(v => `<td>${v ?? '<em style="color:var(--text-muted)">null</em>'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
}

// ===== HELPERS =====
function metricCard(title, value, sub) {
    return `<div class="card metric-card"><p class="card-title">${title}</p><p class="card-value">${value}</p><p class="card-sub">${sub}</p></div>`;
}

function fmt(n) { return Number(n).toLocaleString(); }

function plotlyLayout(height) {
    return {
        height, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#8888a8', family: 'Inter', size: 11 },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        xaxis: { gridcolor: 'rgba(99,102,241,0.08)', zerolinecolor: 'rgba(99,102,241,0.1)' },
        yaxis: { gridcolor: 'rgba(99,102,241,0.08)', zerolinecolor: 'rgba(99,102,241,0.1)' },
    };
}
