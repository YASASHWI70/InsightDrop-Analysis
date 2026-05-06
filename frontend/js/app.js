/**
 * InsightDrop frontend application.
 * Handles file upload, API communication, and dashboard rendering.
 */

const API = '';
let analysisData = null;
let currentDatasetId = null;

// DOM refs
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const browseBtn      = document.getElementById('browse-btn');
const uploadScreen   = document.getElementById('upload-screen');
const dashScreen     = document.getElementById('dashboard-screen');
const uploadProgress = document.getElementById('upload-progress');
const loadingOverlay = document.getElementById('loading-overlay');
const newUploadBtn   = document.getElementById('new-upload-btn');
const sidebarNav     = document.getElementById('sidebar-nav');
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebar-toggle');

document.addEventListener('DOMContentLoaded', init);

function init() {
    setupUpload();
    setupNav();
    newUploadBtn.addEventListener('click', resetToUpload);
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
}

// â”€â”€ Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupUpload() {
    browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

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

    uploadProgress.classList.remove('hidden');
    setProgressLabel('Uploading fileâ€¦');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).detail || 'Upload failed');
        const uploadData = await uploadRes.json();

        setProgressLabel('Running full analysisâ€¦');
        document.getElementById('loader-sub').textContent = 'Running full analysis pipelineâ€¦';
        loadingOverlay.classList.remove('hidden');

        const analyzeRes = await fetch(`${API}/api/analyze/${uploadData.dataset_id}`);
        if (!analyzeRes.ok) throw new Error('Analysis failed');
        analysisData = await analyzeRes.json();
        currentDatasetId = uploadData.dataset_id;

        renderDashboard(analysisData);

        uploadScreen.classList.remove('active');
        dashScreen.classList.add('active');
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        uploadProgress.classList.add('hidden');
        loadingOverlay.classList.add('hidden');
        fileInput.value = '';
    }
}

function setProgressLabel(text) {
    const el = document.getElementById('progress-label');
    if (el) el.textContent = text;
}

function resetToUpload() {
    dashScreen.classList.remove('active');
    uploadScreen.classList.add('active');
    analysisData = null;
    currentDatasetId = null;
    // reset nav to overview
    sidebarNav.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
    sidebarNav.querySelector('[data-tab="overview"]').classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById('panel-overview').classList.add('active');
}

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function setupNav() {
    sidebarNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-item');
        if (!btn) return;
        sidebarNav.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
        // on mobile auto-close sidebar
        if (window.innerWidth <= 800) sidebar.classList.add('collapsed');
    });
}

// â”€â”€ Dashboard render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderDashboard(data) {
    const ov = data.profile.overview;
    const qy = data.profile.data_quality;

    // topbar
    document.getElementById('file-name').textContent = data.filename;
    document.getElementById('file-meta').textContent = `${fmt(ov.rows)} rows Ã— ${ov.columns} cols`;

    // summary chips
    document.getElementById('sum-rows').textContent    = fmt(ov.rows);
    document.getElementById('sum-cols').textContent    = ov.columns;
    document.getElementById('sum-missing').textContent = `${ov.missing_percentage}%`;
    document.getElementById('sum-quality').textContent = `${qy.score}`;

    renderOverview(data.profile);
    renderStatistics(data.statistics);
    renderCorrelations(data.correlations);
    renderOutliers(data.outliers);
    renderVisualizations(data.visualizations);
    renderDataPreview(data.profile.sample_data);
    initTargetSelector(data.profile.columns);
}

function renderOverview(profile) {
    const overview = profile.overview;
    const quality  = profile.data_quality;

    document.getElementById('overview-cards').innerHTML = [
        metricCard('Total Rows',     fmt(overview.rows),                  'records'),
        metricCard('Total Columns',  overview.columns,                    `${overview.numeric_columns} numeric, ${overview.categorical_columns} categorical`),
        metricCard('Missing Cells',  fmt(overview.missing_cells),         `${overview.missing_percentage}% of all data`),
        metricCard('Duplicate Rows', fmt(overview.duplicate_rows),        `${overview.duplicate_percentage}%`),
    ].join('');

    const pct           = quality.score;
    const circumference = 2 * Math.PI * 48;
    const offset        = circumference - (pct / 100) * circumference;
    const color         = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';

    document.getElementById('quality-card').innerHTML = `
        <p class="card-title">Data Quality Score</p>
        <div class="quality-ring">
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" stroke-width="6"/>
                <circle cx="60" cy="60" r="48" fill="none" stroke="${color}" stroke-width="6"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                    stroke-linecap="round" style="transition:stroke-dashoffset 1s ease"/>
            </svg>
            <div class="score-text">
                <span class="score-value" style="color:${color}">${pct}</span>
                <span class="score-grade">Grade ${escapeHtml(quality.grade)}</span>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;font-size:.82rem;color:var(--text);font-weight:600">
            <span>Completeness: ${quality.completeness}%</span>
            <span>Uniqueness: ${quality.uniqueness}%</span>
            <span>Consistency: ${quality.consistency}%</span>
            <span>Variety: ${quality.variety}%</span>
        </div>
        ${quality.issues.length ? `<ul class="issue-list">${quality.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : ''}`;

    document.getElementById('column-types-card').innerHTML = `
        <div class="card-title-row">
            <p class="card-title">Column Types</p>
            <div class="dtype-legend">
                <span><i style="background:#6366f1"></i>Numeric</span>
                <span><i style="background:#0ea5e9"></i>Categorical</span>
                <span><i style="background:#d97706"></i>Datetime</span>
            </div>
        </div>
        <div id="dtype-chart"></div>`;

    Plotly.newPlot('dtype-chart', [{
        values: [overview.numeric_columns, overview.categorical_columns, overview.datetime_columns],
        labels: ['Numeric', 'Categorical', 'Datetime'],
        type: 'pie', hole: 0.6,
        marker: { colors: ['#6366f1', '#0ea5e9', '#d97706'] },
        textinfo: 'none', hoverinfo: 'label+value+percent', sort: false,
    }], { ...plotlyLayout(230), showlegend: false, margin: { l: 8, r: 8, t: 4, b: 4 } },
    { responsive: true, displayModeBar: false });

    document.getElementById('columns-table-card').innerHTML = `
        <p class="card-title">Column Details</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Category</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>${profile.columns.map((col) => `<tr>
                <td style="font-weight:800;color:var(--ink)">${escapeHtml(col.name)}</td>
                <td><span class="badge badge-info">${escapeHtml(col.dtype)}</span></td>
                <td>${escapeHtml(col.category || 'â€”')}</td>
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
        metricCard('Most Variable',   overall.most_variable_column || 'N/A', 'highest coefficient of variation'),
        metricCard('Highly Skewed',   overall.highly_skewed_columns?.length || 0, 'columns with |skew| > 1'),
    ].join('');

    if (!stats.summary.length) {
        document.getElementById('stats-table-card').innerHTML = '<div class="info-message">No numeric columns to analyze.</div>';
        return;
    }

    const fields = ['column','count','mean','median','std','min','max','q1','q3','skewness','kurtosis','distribution_shape'];
    document.getElementById('stats-table-card').innerHTML = `
        <p class="card-title">Descriptive Statistics</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${fields.map((f) => `<th>${escapeHtml(f.replace('_',' '))}</th>`).join('')}</tr></thead>
            <tbody>${stats.summary.map((s) => `<tr>${fields.map((f) => {
                let v = s[f];
                if (typeof v === 'number' && f !== 'count') v = v.toLocaleString(undefined, { maximumFractionDigits: 4 });
                if (f === 'column') return `<td style="font-weight:800;color:var(--ink)">${escapeHtml(v)}</td>`;
                if (f === 'distribution_shape') return `<td><span class="badge badge-info">${escapeHtml(v)}</span></td>`;
                return `<td>${formatValue(v)}</td>`;
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

    document.getElementById('corr-heatmap-card').innerHTML =
        `<p class="card-title">Correlation Heatmap</p><div id="corr-heatmap" style="height:450px"></div>`;
    const m = corr.matrix;
    Plotly.newPlot('corr-heatmap', [{
        z: m.values, x: m.columns, y: m.columns, type: 'heatmap',
        colorscale: 'RdBu', reversescale: true, zmin: -1, zmax: 1,
        text: m.values.map((row) => row.map((v) => v != null ? v.toFixed(2) : '')),
        texttemplate: '%{text}', textfont: { size: 10 },
    }], { ...plotlyLayout(420), margin: { l: 100, r: 40, t: 20, b: 100 } },
    { responsive: true, displayModeBar: false });

    document.getElementById('corr-strong-card').innerHTML = `
        <p class="card-title">Strong Correlations (|r| â‰¥ 0.5)</p>
        ${(corr.strong_pairs||[]).length === 0 ? '<div class="info-message">No strong correlations found.</div>' :
        (corr.strong_pairs||[]).slice(0,10).map((p) => `<div class="pair-item">
            <span class="pair-cols">${escapeHtml(p.column_1)} â†” ${escapeHtml(p.column_2)}</span>
            <span class="pair-val" style="color:${p.correlation>0?'var(--success)':'var(--danger)'}">${p.correlation.toFixed(4)}</span>
        </div>`).join('')}`;

    document.getElementById('corr-top-card').innerHTML = `
        <p class="card-title">Top Positive Correlations</p>
        ${(corr.top_positive||[]).length === 0 ? '<div class="info-message">None found.</div>' :
        (corr.top_positive||[]).map((p) => `<div class="pair-item">
            <span class="pair-cols">${escapeHtml(p.column_1)} â†” ${escapeHtml(p.column_2)}</span>
            <span class="pair-val" style="color:var(--success)">${p.correlation.toFixed(4)}</span>
        </div>`).join('')}`;
}

function renderOutliers(outliers) {
    const s = outliers.summary;
    document.getElementById('outlier-summary-cards').innerHTML = [
        metricCard('Total Outliers', fmt(outliers.total_outliers), `across ${s.columns_with_outliers} columns`),
        metricCard('Clean Columns',  s.columns_without_outliers,  'no outliers detected'),
        metricCard('High Severity',  s.high_severity_columns?.length || 0, s.recommendation?.slice(0,50) || ''),
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
                const c = col.severity==='high'?'danger':col.severity==='medium'?'warning':'success';
                return `<tr>
                    <td style="font-weight:800;color:var(--ink)">${escapeHtml(col.column)}</td>
                    <td>${fmt(col.outlier_count)}</td><td>${col.outlier_percentage}%</td>
                    <td>${formatValue(col.bounds.lower)}</td><td>${formatValue(col.bounds.upper)}</td>
                    <td>${formatValue(col.iqr)}</td>
                    <td><span class="badge badge-${c}">${escapeHtml(col.severity)}</span></td>
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
    viz.charts.forEach((chart, i) => {
        if (chart.type === 'info') {
            container.innerHTML += `<div class="chart-card"><div class="chart-card-title">${escapeHtml(chart.title)}</div><div class="info-message">${escapeHtml(chart.message)}</div></div>`;
            return;
        }
        const div = document.createElement('div');
        div.className = `chart-card${['heatmap','box'].includes(chart.type) ? ' full-width' : ''}`;
        div.innerHTML = `<div class="chart-card-title">${escapeHtml(chart.title)}</div><div class="chart-container" id="chart-${i}"></div>`;
        container.appendChild(div);
        setTimeout(() => {
            Plotly.newPlot(`chart-${i}`, chart.data, { ...plotlyLayout(300), ...(chart.layout||{}) }, { responsive: true, displayModeBar: false });
        }, 50);
    });
}

function renderDataPreview(sample) {
    if (!sample) { document.getElementById('data-table-card').innerHTML = '<div class="info-message">No preview available.</div>'; return; }
    document.getElementById('data-table-card').innerHTML = `
        <p class="card-title">Data Preview (First 10 Rows)</p>
        <div class="data-table-wrap"><table class="data-table">
            <thead><tr>${sample.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>${sample.head.map((row) => `<tr>${row.map((v) => `<td>${formatValue(v)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
}

function metricCard(title, value, sub) {
    return `<div class="metric-card"><p class="card-title">${escapeHtml(title)}</p><p class="card-value">${escapeHtml(String(value))}</p><p class="card-sub">${escapeHtml(sub)}</p></div>`;
}

// â”€â”€ Target Variable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function initTargetSelector(columns) {
    const select = document.getElementById('target-col-select');
    const btn    = document.getElementById('target-run-btn');
    select.innerHTML = '<option value="">â€” select a column â€”</option>';
    columns.forEach((col) => {
        const opt = document.createElement('option');
        opt.value = col.name; opt.textContent = col.name;
        select.appendChild(opt);
    });
    // remove old listeners by cloning
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newSelect.addEventListener('change', () => { newBtn.disabled = !newSelect.value; });
    newBtn.addEventListener('click', () => { if (newSelect.value) runTargetAnalysis(newSelect.value); });
}

async function runTargetAnalysis(targetCol) {
    const content = document.getElementById('target-content');
    content.innerHTML = '<div class="info-message">Running target analysisâ€¦</div>';
    try {
        const res = await fetch(`${API}/api/target/${currentDatasetId}?target_col=${encodeURIComponent(targetCol)}`);
        if (!res.ok) throw new Error((await res.json()).detail || 'Target analysis failed');
        renderTarget(await res.json());
    } catch (err) {
        content.innerHTML = `<div class="info-message" style="color:var(--danger)">Error: ${escapeHtml(err.message)}</div>`;
    }
}

function renderTarget(data) {
    const content = document.getElementById('target-content');
    const pt = data.problem_type;

    const statCardsHtml = `
        <div class="kpi-row mb-lg">
            ${data.stat_cards.map((c) => `
                <div class="metric-card">
                    <p class="card-title">${escapeHtml(c.label)}</p>
                    <p class="card-value">${escapeHtml(String(c.value ?? 'â€”'))}</p>
                    ${c.sub ? `<p class="card-sub">${escapeHtml(c.sub)}</p>` : ''}
                </div>`).join('')}
        </div>`;

    const noteHtml = pt.note ? `<div class="target-note">${escapeHtml(pt.note)}</div>` : '';
    const problemHtml = `
        <div class="card mb-lg">
            <p class="card-title">Problem Type</p>
            <div class="target-problem-badge" style="border-left-color:${escapeHtml(pt.color)}">
                <span class="target-type-pill" style="background:${escapeHtml(pt.color)}22;color:${escapeHtml(pt.color)}">${escapeHtml(pt.label)}</span>
                <p style="color:var(--muted);font-size:.88rem;margin:.35rem 0 0">${escapeHtml(pt.reason)}</p>
            </div>
            ${noteHtml}
            <p class="card-title" style="margin-top:.9rem">Recommended Algorithms</p>
            <div class="target-algo-grid">
                ${data.recommended_algorithms.map((a) => `
                    <div class="target-algo-item" style="border-left-color:${escapeHtml(pt.color)}">
                        <div class="target-algo-name">${escapeHtml(a.name)}</div>
                        <div class="target-algo-reason">${escapeHtml(a.reason)}</div>
                    </div>`).join('')}
            </div>
        </div>`;

    let classDist = '';
    if (data.class_distribution) {
        const cd = data.class_distribution;
        classDist = `<div class="card mb-lg"><p class="card-title">Class Distribution${cd.truncated ? ` â€” top 20 of ${cd.total_classes}` : ''}</p><div id="target-class-dist" style="min-height:280px"></div></div>`;
    }

    const distributionHtml = `
        <div class="card mb-lg">
            <p class="card-title">${escapeHtml(data.distribution.type === 'histogram' ? `Distribution of ${data.target_col}` : `Top Values â€” ${data.target_col}`)}</p>
            <div id="target-dist-chart" style="min-height:300px"></div>
        </div>`;

    const corr = data.correlations;
    let corrHtml = '';
    if (corr.message) {
        corrHtml = `<div class="card mb-lg"><div class="info-message">${escapeHtml(corr.message)}</div></div>`;
    } else if (corr.type === 'pearson') {
        corrHtml = `<div class="card mb-lg"><p class="card-title">Pearson Correlation with '${escapeHtml(data.target_col)}'</p><div id="target-corr-chart" style="min-height:300px"></div></div>`;
    } else {
        corrHtml = `
            <div class="card mb-lg">
                <p class="card-title">Group Means by '${escapeHtml(data.target_col)}'${corr.truncated ? ` â€” top 20 of ${corr.total_categories}` : ''}</p>
                <div class="data-table-wrap"><table class="data-table">
                    <thead><tr><th>${escapeHtml(data.target_col)}</th>${corr.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
                    <tbody>${corr.categories.map((cat, i) => `<tr>
                        <td style="font-weight:800;color:var(--ink)">${escapeHtml(cat)}</td>
                        ${corr.values[i].map((v) => `<td>${formatValue(v)}</td>`).join('')}
                    </tr>`).join('')}</tbody>
                </table></div>
            </div>`;
    }

    content.innerHTML = statCardsHtml + problemHtml + classDist + distributionHtml + corrHtml;

    const layout = plotlyLayout(320);

    if (data.class_distribution) {
        const cd = data.class_distribution;
        Plotly.newPlot('target-class-dist', [{
            x: cd.counts, y: cd.labels, orientation: 'h', type: 'bar',
            marker: { color: cd.labels.map((_, i) => `hsl(${(i*47)%360},55%,52%)`) },
            text: cd.percentages.map((p, i) => `${p}% (${fmt(cd.counts[i])})`),
            textposition: 'inside', insidetextanchor: 'start',
            hovertemplate: '<b>%{y}</b><br>Count: %{x:,}<extra></extra>',
        }], { ...plotlyLayout(Math.max(280, cd.labels.length*34+80)), showlegend: false,
            margin: { l: 160, r: 20, t: 20, b: 40 }, yaxis: { autorange: 'reversed' }, xaxis: { title: 'Count' } },
        { responsive: true, displayModeBar: false });
    }

    if (data.distribution.type === 'histogram') {
        const d = data.distribution;
        Plotly.newPlot('target-dist-chart', [{
            x: d.x, y: d.counts, type: 'bar',
            marker: { color: 'rgba(99,102,241,0.7)' }, name: data.target_col,
        }], { ...layout,
            shapes: [
                { type:'line', x0:d.mean, x1:d.mean, y0:0, y1:1, yref:'paper', line:{ dash:'dash', color:'#d97706', width:1.5 } },
                { type:'line', x0:d.median, x1:d.median, y0:0, y1:1, yref:'paper', line:{ dash:'dot', color:'#0ea5e9', width:1.5 } },
            ],
            annotations: [
                { x:d.mean, y:1, yref:'paper', text:'Mean', showarrow:false, font:{ color:'#d97706', size:10 }, yanchor:'bottom' },
                { x:d.median, y:1, yref:'paper', text:'Median', showarrow:false, font:{ color:'#0ea5e9', size:10 }, yanchor:'bottom', xanchor:'right' },
            ],
            xaxis:{ title:data.target_col }, yaxis:{ title:'Count' },
        }, { responsive:true, displayModeBar:false });
    } else {
        const d = data.distribution;
        Plotly.newPlot('target-dist-chart', [{
            x: d.labels, y: d.counts, type: 'bar',
            marker: { color: 'rgba(14,165,233,0.75)' },
            text: d.percentages.map((p) => `${p}%`), textposition: 'outside',
        }], { ...layout, xaxis:{ title:data.target_col }, yaxis:{ title:'Count' } },
        { responsive:true, displayModeBar:false });
    }

    if (corr.type === 'pearson' && !corr.message) {
        Plotly.newPlot('target-corr-chart', [{
            x: corr.values, y: corr.columns, orientation: 'h', type: 'bar',
            marker: { color: corr.values.map((v) => v < 0 ? '#dc2626' : '#6366f1') },
            text: corr.values.map((v) => `${v>=0?'+':''}${v}`),
            textposition: 'inside', insidetextanchor: 'end',
        }], { ...plotlyLayout(Math.max(280, corr.columns.length*28+80)),
            showlegend: false, margin:{ l:180, r:20, t:20, b:40 },
            xaxis:{ title:'Pearson r', range:[-1.05,1.05] }, yaxis:{ autorange:'reversed' },
            shapes: [
                { type:'line', x0: 0.3, x1: 0.3, y0:0, y1:1, yref:'paper', line:{ dash:'dash', color:'#d97706', width:1 } },
                { type:'line', x0:-0.3, x1:-0.3, y0:0, y1:1, yref:'paper', line:{ dash:'dash', color:'#d97706', width:1 } },
                { type:'line', x0: 0.7, x1: 0.7, y0:0, y1:1, yref:'paper', line:{ dash:'dash', color:'#6366f1', width:1 } },
                { type:'line', x0:-0.7, x1:-0.7, y0:0, y1:1, yref:'paper', line:{ dash:'dash', color:'#6366f1', width:1 } },
            ],
        }, { responsive:true, displayModeBar:false });
    }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmt(value) { return Number(value || 0).toLocaleString(); }

function formatValue(value) {
    if (value === null || value === undefined || value === '') return '<em style="color:var(--muted)">null</em>';
    if (typeof value === 'number') return escapeHtml(value.toLocaleString(undefined, { maximumFractionDigits: 4 }));
    return escapeHtml(value);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function plotlyLayout(height) {
    return {
        height,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)',
        font: { color: '#374151', family: 'Inter', size: 11 },
        margin: { l: 50, r: 20, t: 20, b: 50 },
        xaxis: { gridcolor: 'rgba(0,0,0,.06)', zerolinecolor: 'rgba(0,0,0,.1)' },
        yaxis: { gridcolor: 'rgba(0,0,0,.06)', zerolinecolor: 'rgba(0,0,0,.1)' },
    };
}
