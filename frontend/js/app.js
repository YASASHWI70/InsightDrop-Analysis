/**
 * InsightDrop frontend application.
 * Handles file upload, API communication, and dashboard rendering.
 */

const API = '';
let analysisData = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const uploadSection = document.getElementById('upload-section');
const resultsSection = document.getElementById('results-section');
const uploadProgress = document.getElementById('upload-progress');
const loadingOverlay = document.getElementById('loading-overlay');
const newUploadBtn = document.getElementById('new-upload-btn');
const tabNav = document.getElementById('tab-nav');

document.addEventListener('DOMContentLoaded', init);

function init() {
    setupUpload();
    setupTabs();
    newUploadBtn.addEventListener('click', resetToUpload);
}

function setupUpload() {
    browseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        fileInput.click();
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        if (event.target.files[0]) handleFile(event.target.files[0]);
    });

    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('drag-over');
        if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]);
    });
}

async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Please upload a CSV or Excel file.');
        return;
    }

    uploadProgress.classList.remove('hidden');
    uploadProgress.querySelector('.progress-text').textContent = 'Uploading and analyzing...';

    try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${API}/api/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).detail || 'Upload failed');
        const uploadData = await uploadRes.json();

        uploadProgress.querySelector('.progress-text').textContent = 'Running full analysis...';
        loadingOverlay.classList.remove('hidden');

        const analyzeRes = await fetch(`${API}/api/analyze/${uploadData.dataset_id}`);
        if (!analyzeRes.ok) throw new Error('Analysis failed');
        analysisData = await analyzeRes.json();

        renderDashboard(analysisData);

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

function setupTabs() {
    tabNav.addEventListener('click', (event) => {
        if (!event.target.classList.contains('tab')) return;

        tabNav.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
        event.target.classList.add('active');

        document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
        document.getElementById(`panel-${event.target.dataset.tab}`).classList.add('active');
    });
}

function renderDashboard(data) {
    document.getElementById('file-name').textContent = data.filename;
    document.getElementById('file-meta').textContent =
        `- ${fmt(data.profile.overview.rows)} rows x ${data.profile.overview.columns} columns`;

    renderOverview(data.profile);
    renderStatistics(data.statistics);
    renderCorrelations(data.correlations);
    renderOutliers(data.outliers);
    renderVisualizations(data.visualizations);
    renderDataPreview(data.profile.sample_data);
}

function renderOverview(profile) {
    const overview = profile.overview;
    const quality = profile.data_quality;

    document.getElementById('overview-cards').innerHTML = [
        metricCard('Total Rows', fmt(overview.rows), 'records'),
        metricCard('Total Columns', overview.columns, `${overview.numeric_columns} numeric, ${overview.categorical_columns} categorical`),
        metricCard('Missing Cells', fmt(overview.missing_cells), `${overview.missing_percentage}% of all data`),
        metricCard('Duplicate Rows', fmt(overview.duplicate_rows), `${overview.duplicate_percentage}%`),
    ].join('');

    const pct = quality.score;
    const circumference = 2 * Math.PI * 48;
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    document.getElementById('quality-card').innerHTML = `
        <p class="card-title">Data Quality Score</p>
        <div class="quality-ring">
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" stroke-width="6"/>
                <circle cx="60" cy="60" r="48" fill="none" stroke="${color}" stroke-width="6"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" style="transition: stroke-dashoffset 1s ease"/>
            </svg>
            <div class="score-text">
                <span class="score-value" style="color:${color}">${pct}</span>
                <span class="score-grade">Grade ${escapeHtml(quality.grade)}</span>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.5rem;font-size:0.82rem;color:var(--text);font-weight:650">
            <span>Completeness: ${quality.completeness}%</span>
            <span>Uniqueness: ${quality.uniqueness}%</span>
            <span>Consistency: ${quality.consistency}%</span>
            <span>Variety: ${quality.variety}%</span>
        </div>
        ${quality.issues.length ? `<ul class="issue-list">${quality.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>` : ''}
    `;

    const el = document.getElementById('column-types-card');
    el.innerHTML = `
        <div class="card-title-row">
            <p class="card-title">Column Types</p>
            <div class="dtype-legend" aria-label="Column type colors">
                <span><i style="background:#247a76"></i>Numeric</span>
                <span><i style="background:#5c6f86"></i>Categorical</span>
                <span><i style="background:#ad6a00"></i>Datetime</span>
            </div>
        </div>
        <div id="dtype-chart"></div>
    `;
    const cats = {
        numeric: overview.numeric_columns,
        categorical: overview.categorical_columns,
        datetime: overview.datetime_columns,
    };
    Plotly.newPlot('dtype-chart', [{
        values: Object.values(cats),
        labels: Object.keys(cats),
        type: 'pie',
        hole: 0.58,
        marker: { colors: ['#247a76', '#5c6f86', '#ad6a00'] },
        textinfo: 'none',
        hoverinfo: 'label+value+percent',
        sort: false,
    }], {
        ...plotlyLayout(250),
        showlegend: false,
        margin: { l: 8, r: 8, t: 4, b: 4 },
    }, { responsive: true, displayModeBar: false });

    const cols = profile.columns;
    document.getElementById('columns-table-card').innerHTML = `
        <p class="card-title">Column Details</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Category</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>${cols.map((col) => `<tr>
                <td style="font-weight:800;color:var(--ink)">${escapeHtml(col.name)}</td>
                <td><span class="badge badge-info">${escapeHtml(col.dtype)}</span></td>
                <td>${escapeHtml(col.category || '-')}</td>
                <td>${fmt(col.missing)} <span style="color:var(--muted)">(${col.missing_pct}%)</span></td>
                <td>${fmt(col.unique)}</td>
                <td>${formatValue(col.min)}</td>
                <td>${formatValue(col.max)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
}

function renderStatistics(stats) {
    const overall = stats.overall;
    document.getElementById('stats-overall').innerHTML = [
        metricCard('Numeric Columns', overall.total_numeric_columns, ''),
        metricCard('Most Variable', overall.most_variable_column || 'N/A', 'highest coefficient of variation'),
        metricCard('Highly Skewed', overall.highly_skewed_columns?.length || 0, 'columns with |skew| > 1'),
    ].join('');

    if (!stats.summary.length) {
        document.getElementById('stats-table-card').innerHTML = '<div class="info-message">No numeric columns to analyze.</div>';
        return;
    }

    const fields = ['column', 'count', 'mean', 'median', 'std', 'min', 'max', 'q1', 'q3', 'skewness', 'kurtosis', 'distribution_shape'];
    document.getElementById('stats-table-card').innerHTML = `
        <p class="card-title">Descriptive Statistics</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${fields.map((field) => `<th>${escapeHtml(field.replace('_', ' '))}</th>`).join('')}</tr></thead>
            <tbody>${stats.summary.map((summary) => `<tr>${fields.map((field) => {
                let value = summary[field];
                if (typeof value === 'number' && field !== 'count') {
                    value = value.toLocaleString(undefined, { maximumFractionDigits: 4 });
                }
                if (field === 'column') return `<td style="font-weight:800;color:var(--ink)">${escapeHtml(value)}</td>`;
                if (field === 'distribution_shape') return `<td><span class="badge badge-info">${escapeHtml(value)}</span></td>`;
                return `<td>${formatValue(value)}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
}

function renderCorrelations(corr) {
    if (corr.matrix === null) {
        document.getElementById('corr-heatmap-card').innerHTML = `<div class="info-message">${escapeHtml(corr.message)}</div>`;
        document.getElementById('corr-strong-card').innerHTML = '';
        document.getElementById('corr-top-card').innerHTML = '';
        return;
    }

    const heatmap = document.getElementById('corr-heatmap-card');
    heatmap.innerHTML = `<p class="card-title">Correlation Heatmap</p><div id="corr-heatmap" style="height:450px"></div>`;
    const matrix = corr.matrix;
    Plotly.newPlot('corr-heatmap', [{
        z: matrix.values,
        x: matrix.columns,
        y: matrix.columns,
        type: 'heatmap',
        colorscale: 'RdBu',
        reversescale: true,
        zmin: -1,
        zmax: 1,
        text: matrix.values.map((row) => row.map((value) => value !== null ? value.toFixed(2) : '')),
        texttemplate: '%{text}',
        textfont: { size: 10 },
    }], { ...plotlyLayout(420), margin: { l: 100, r: 40, t: 20, b: 100 } },
    { responsive: true, displayModeBar: false });

    const strongPairs = corr.strong_pairs || [];
    document.getElementById('corr-strong-card').innerHTML = `
        <p class="card-title">Strong Correlations (|r| >= 0.5)</p>
        ${strongPairs.length === 0 ? '<div class="info-message">No strong correlations found.</div>' :
        strongPairs.slice(0, 10).map((pair) => `<div class="pair-item">
            <span class="pair-cols">${escapeHtml(pair.column_1)} <-> ${escapeHtml(pair.column_2)}</span>
            <span class="pair-val" style="color:${pair.correlation > 0 ? 'var(--success)' : 'var(--danger)'}">${pair.correlation.toFixed(4)}</span>
        </div>`).join('')}`;

    const topPositive = corr.top_positive || [];
    document.getElementById('corr-top-card').innerHTML = `
        <p class="card-title">Top Positive Correlations</p>
        ${topPositive.length === 0 ? '<div class="info-message">None found.</div>' :
        topPositive.map((pair) => `<div class="pair-item">
            <span class="pair-cols">${escapeHtml(pair.column_1)} <-> ${escapeHtml(pair.column_2)}</span>
            <span class="pair-val" style="color:var(--success)">${pair.correlation.toFixed(4)}</span>
        </div>`).join('')}`;
}

function renderOutliers(outliers) {
    const summary = outliers.summary;
    document.getElementById('outlier-summary-cards').innerHTML = [
        metricCard('Total Outliers', fmt(outliers.total_outliers), `across ${summary.columns_with_outliers} columns`),
        metricCard('Clean Columns', summary.columns_without_outliers, 'no outliers detected'),
        metricCard('High Severity', summary.high_severity_columns?.length || 0, summary.recommendation?.slice(0, 50) || ''),
    ].join('');

    if (!outliers.columns.length) {
        document.getElementById('outlier-table-card').innerHTML = '<div class="info-message">No numeric columns.</div>';
        return;
    }

    document.getElementById('outlier-table-card').innerHTML = `
        <p class="card-title">Outlier Detection (IQR Method)</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Column</th><th>Outliers</th><th>%</th><th>Lower Bound</th><th>Upper Bound</th><th>IQR</th><th>Severity</th></tr></thead>
            <tbody>${outliers.columns.map((col) => {
                const sevClass = col.severity === 'high' ? 'danger' : col.severity === 'medium' ? 'warning' : 'success';
                return `<tr>
                    <td style="font-weight:800;color:var(--ink)">${escapeHtml(col.column)}</td>
                    <td>${fmt(col.outlier_count)}</td>
                    <td>${col.outlier_percentage}%</td>
                    <td>${formatValue(col.bounds.lower)}</td>
                    <td>${formatValue(col.bounds.upper)}</td>
                    <td>${formatValue(col.iqr)}</td>
                    <td><span class="badge badge-${sevClass}">${escapeHtml(col.severity)}</span></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
}

function renderVisualizations(viz) {
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    if (!viz.charts || viz.charts.length === 0) {
        container.innerHTML = '<div class="info-message">No charts to display.</div>';
        return;
    }

    viz.charts.forEach((chart, index) => {
        if (chart.type === 'info') {
            container.innerHTML += `<div class="chart-card"><div class="chart-card-title">${escapeHtml(chart.title)}</div><div class="info-message">${escapeHtml(chart.message)}</div></div>`;
            return;
        }

        const isWide = ['heatmap', 'box'].includes(chart.type);
        const div = document.createElement('div');
        div.className = `chart-card${isWide ? ' full-width' : ''}`;
        div.innerHTML = `<div class="chart-card-title">${escapeHtml(chart.title)}</div><div class="chart-container" id="chart-${index}"></div>`;
        container.appendChild(div);

        const layout = { ...plotlyLayout(310), ...(chart.layout || {}) };
        setTimeout(() => {
            Plotly.newPlot(`chart-${index}`, chart.data, layout, { responsive: true, displayModeBar: false });
        }, 50);
    });
}

function renderDataPreview(sample) {
    if (!sample) {
        document.getElementById('data-table-card').innerHTML = '<div class="info-message">No preview available.</div>';
        return;
    }

    document.getElementById('data-table-card').innerHTML = `
        <p class="card-title">Data Preview (First 10 Rows)</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${sample.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
            <tbody>${sample.head.map((row) => `<tr>${row.map((value) => `<td>${formatValue(value)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
}

function metricCard(title, value, sub) {
    return `<div class="card metric-card"><p class="card-title">${escapeHtml(title)}</p><p class="card-value">${escapeHtml(value)}</p><p class="card-sub">${escapeHtml(sub)}</p></div>`;
}

function fmt(value) {
    return Number(value || 0).toLocaleString();
}

function formatValue(value) {
    if (value === null || value === undefined || value === '') {
        return '<em style="color:var(--muted)">null</em>';
    }
    if (typeof value === 'number') {
        return escapeHtml(value.toLocaleString(undefined, { maximumFractionDigits: 4 }));
    }
    return escapeHtml(value);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function plotlyLayout(height) {
    return {
        height,
        paper_bgcolor: 'rgba(255,255,255,0)',
        plot_bgcolor: 'rgba(255,255,255,0)',
        font: { color: '#435063', family: 'Inter', size: 11 },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        xaxis: {
            gridcolor: 'rgba(24,34,48,0.08)',
            zerolinecolor: 'rgba(24,34,48,0.12)',
        },
        yaxis: {
            gridcolor: 'rgba(24,34,48,0.08)',
            zerolinecolor: 'rgba(24,34,48,0.12)',
        },
    };
}
