type MetricType = 'counter' | 'gauge' | 'histogram';
type MetricLabels = Record<string, string | number | boolean | null | undefined>;

type MetricDefinition = {
  help: string;
  type: MetricType;
};

const histogramBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

const sanitizeMetricName = (name: string) => name.replace(/[^a-zA-Z0-9_:]/g, '_');

const normalizeLabelValue = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value);
};

const labelsKey = (labels: MetricLabels) =>
  Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${normalizeLabelValue(value)}`)
    .join('|');

const renderLabels = (labels: MetricLabels) => {
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) return '';

  const rendered = entries
    .map(([key, value]) => {
      const escaped = normalizeLabelValue(value)
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/"/g, '\\"');
      return `${key}="${escaped}"`;
    })
    .join(',');

  return `{${rendered}}`;
};

class MetricsRegistry {
  private definitions = new Map<string, MetricDefinition>();
  private samples = new Map<string, Map<string, { labels: MetricLabels; value: number }>>();

  increment(name: string, help: string, labels: MetricLabels = {}, value = 1) {
    const metricName = sanitizeMetricName(name);
    this.define(metricName, help, 'counter');
    const current = this.getSample(metricName, labels);
    current.value += value;
  }

  setGauge(name: string, help: string, labels: MetricLabels = {}, value: number) {
    const metricName = sanitizeMetricName(name);
    this.define(metricName, help, 'gauge');
    this.getSample(metricName, labels).value = value;
  }

  observe(name: string, help: string, labels: MetricLabels = {}, value: number, buckets = histogramBuckets) {
    const metricName = sanitizeMetricName(name);
    this.define(metricName, help, 'histogram');

    for (const bucket of buckets) {
      if (value <= bucket) {
        this.getSample(`${metricName}_bucket`, { ...labels, le: bucket }).value += 1;
      }
    }

    this.getSample(`${metricName}_bucket`, { ...labels, le: '+Inf' }).value += 1;
    this.getSample(`${metricName}_sum`, labels).value += value;
    this.getSample(`${metricName}_count`, labels).value += 1;
  }

  renderPrometheus() {
    const lines: string[] = [];
    const emitted = new Set<string>();

    for (const [name, definition] of this.definitions.entries()) {
      lines.push(`# HELP ${name} ${definition.help}`);
      lines.push(`# TYPE ${name} ${definition.type}`);
      emitted.add(name);

      if (definition.type === 'histogram') {
        this.renderSamples(lines, `${name}_bucket`);
        this.renderSamples(lines, `${name}_sum`);
        this.renderSamples(lines, `${name}_count`);
      } else {
        this.renderSamples(lines, name);
      }
    }

    for (const name of this.samples.keys()) {
      const baseName = name.replace(/_(bucket|sum|count)$/, '');
      if (emitted.has(baseName)) continue;
      this.renderSamples(lines, name);
    }

    return `${lines.join('\n')}\n`;
  }

  resetForTests() {
    this.definitions.clear();
    this.samples.clear();
  }

  private define(name: string, help: string, type: MetricType) {
    if (!this.definitions.has(name)) {
      this.definitions.set(name, { help, type });
    }
  }

  private getSample(name: string, labels: MetricLabels) {
    if (!this.samples.has(name)) {
      this.samples.set(name, new Map());
    }

    const byLabels = this.samples.get(name)!;
    const key = labelsKey(labels);
    if (!byLabels.has(key)) {
      byLabels.set(key, { labels, value: 0 });
    }

    return byLabels.get(key)!;
  }

  private renderSamples(lines: string[], name: string) {
    const byLabels = this.samples.get(name);
    if (!byLabels) return;

    for (const sample of byLabels.values()) {
      lines.push(`${name}${renderLabels(sample.labels)} ${sample.value}`);
    }
  }
}

export const metricsRegistry = new MetricsRegistry();
