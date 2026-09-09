const VERSION = "0.1.0";

class HAElectricityPriceCardEditor extends HTMLElement {
  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _change(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    if (!this._config) return;
    this.innerHTML = `<style>.row{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:12px;margin:12px 0}select,input{width:100%;padding:8px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color)}</style>
      <div class="row"><label>Datakilde</label><select data-key="source"><option value="auto">Automatisk</option><option value="stromligning">Strømligning</option><option value="energidataservice">Energi Data Service</option></select></div>
      <div class="row"><label>Strømligning pris</label><input data-key="stromligning_current"></div>
      <div class="row"><label>Strømligning i morgen</label><input data-key="stromligning_tomorrow"></div>
      <div class="row"><label>Strømligning forecast</label><input data-key="stromligning_forecast"></div>
      <div class="row"><label>Energi Data Service</label><input data-key="energidataservice"></div>`;
    this.querySelectorAll("select,input").forEach(el => { el.value = this._config[el.dataset.key] || (el.dataset.key === "source" ? "auto" : ""); el.onchange = () => this._change(el.dataset.key, el.value); });
  }
}

class HAElectricityPriceCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); this._config = {}; this._tab = "today"; this._forecastDay = 0; this._sig = ""; }
  static getStubConfig() { return { source: "auto", energidataservice: "sensor.energi_data_service", stromligning_current: "sensor.stromligning_current_price_vat", stromligning_tomorrow: "binary_sensor.stromligning_tomorrow_available_vat", stromligning_forecast: "sensor.stromligning_forecasts_vat" }; }
  static getConfigElement() { return document.createElement("ha-electricity-price-card-editor"); }
  setConfig(config) { this._config = { ...HAElectricityPriceCard.getStubConfig(), ...config }; this._render(); }
  set hass(hass) { this._hass = hass; const ids = [this._config.energidataservice, this._config.stromligning_current, this._config.stromligning_tomorrow, this._config.stromligning_forecast]; const sig = JSON.stringify(ids.map(id => [id, hass?.states?.[id]?.state, hass?.states?.[id]?.last_updated])); if (sig !== this._sig) { this._sig = sig; this._render(); } }
  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, rows: 4, min_columns: 6 }; }
  _entity(id) { return this._hass?.states?.[id]; }
  _source() { const requested = this._config.source || "auto"; if (requested !== "auto") return requested; if (this._entity(this._config.stromligning_current)?.attributes?.prices?.length) return "stromligning"; return "energidataservice"; }
  _point(item, fallbackHour = 0, dayOffset = 0) { const price = Number(item?.price ?? item); const raw = item?.start ?? item?.hour; const start = raw ? Date.parse(raw) : new Date(new Date().setHours(fallbackHour, 0, 0, 0) + dayOffset * 86400000).getTime(); return Number.isFinite(price) && Number.isFinite(start) ? { price, start } : null; }
  _stromligning() {
    const todayEntity = this._entity(this._config.stromligning_current), tomorrowEntity = this._entity(this._config.stromligning_tomorrow), forecastEntity = this._entity(this._config.stromligning_forecast);
    const today = (todayEntity?.attributes?.prices || []).map((p, i) => this._point(p, i)).filter(Boolean);
    const tomorrow = (tomorrowEntity?.attributes?.prices || []).map((p, i) => this._point(p, i, 1)).filter(Boolean);
    const forecast = (forecastEntity?.attributes?.prices || []).map((p, i) => this._point(p, i, 2)).filter(Boolean);
    return { source: "Strømligning", current: Number(todayEntity?.state), today, tomorrow, forecast, tomorrowOfficial: tomorrowEntity?.attributes?.forecast_data !== true };
  }
  _eds() {
    const entity = this._entity(this._config.energidataservice), a = entity?.attributes || {};
    const make = (raw, simple, offset) => (Array.isArray(raw) && raw.length ? raw : simple || []).map((p, i) => this._point(p, i, offset)).filter(Boolean);
    return { source: "Energi Data Service", current: Number(a.current_price ?? entity?.state), today: make(a.raw_today, a.today, 0), tomorrow: make(a.raw_tomorrow, a.tomorrow, 1), forecast: (a.forecast || []).map((p, i) => this._point(p, i, 2)).filter(Boolean), tomorrowOfficial: a.tomorrow_valid === true };
  }
  _data() { return this._source() === "energidataservice" ? this._eds() : this._stromligning(); }
  _days(points) { const map = new Map(); points.forEach(p => { const d = new Date(p.start), key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; if (!map.has(key)) map.set(key, []); map.get(key).push(p); }); return [...map.values()].map(x => x.sort((a, b) => a.start - b.start)); }
  _selected(data) { if (this._tab === "today") return data.today; if (this._tab === "tomorrow") return data.tomorrow; const days = this._days(data.forecast); this._forecastDay = Math.max(0, Math.min(this._forecastDay, Math.max(0, days.length - 1))); return days[this._forecastDay] || []; }
  _fmt(value) { return Number.isFinite(value) ? value.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
  _date(points) { if (!points.length) return "Ingen data"; return new Date(points[0].start).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" }); }
  _bars(points) {
    if (!points.length) return `<div class="empty"><ha-icon icon="mdi:chart-bar-off"></ha-icon><span>Ingen prisdata for denne dag</span></div>`;
    const values = points.map(p => p.price), min = Math.min(...values), max = Math.max(...values), span = Math.max(.01, max - min), now = Date.now();
    return `<div class="chart">${points.map(p => { const h = 18 + ((p.price - min) / span) * 82, d = new Date(p.start), hour = String(d.getHours()).padStart(2, "0"), current = now >= p.start && now < p.start + 3600000, extreme = p.price === min ? "min" : p.price === max ? "max" : ""; return `<button class="bar-wrap ${current ? "current" : ""} ${extreme}" title="${hour}:00 · ${this._fmt(p.price)} kr/kWh"><span class="tip">${hour}:00<br><b>${this._fmt(p.price)}</b></span><i style="--h:${h}%;--ratio:${(p.price - min) / span}"></i><small>${Number(hour) % 3 === 0 ? hour : ""}</small></button>`; }).join("")}</div>`;
  }
  _render() {
    if (!this.shadowRoot) return; const data = this._data(), points = this._selected(data), values = points.map(p => p.price), min = values.length ? Math.min(...values) : NaN, max = values.length ? Math.max(...values) : NaN, avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN, forecastDays = this._days(data.forecast).length;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;--accent:var(--dashboard-accent,#62b5ff);--good:var(--dashboard-success,#54d9aa);--warn:var(--dashboard-warning,#ffbd59);--danger:var(--dashboard-danger,#ff667a);--edge:var(--dashboard-border-neutral,rgba(255,255,255,.12));--surface-local:var(--surface,var(--ha-card-background,#101a28))}*{box-sizing:border-box}ha-card{position:relative;overflow:hidden;padding:16px;border:1px solid var(--edge);border-left:4px solid var(--accent);border-radius:18px;background:var(--surface-local);color:var(--primary-text-color);box-shadow:var(--dashboard-card-shadow,var(--ha-card-box-shadow))}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.price{display:flex;align-items:center;gap:10px}.price ha-icon{width:30px;color:var(--accent);--mdc-icon-size:30px}.price b{font-size:31px;line-height:1}.price small,.meta{color:var(--secondary-text-color);font-size:10px}.source{padding:5px 8px;border:1px solid var(--edge);border-radius:999px;color:var(--secondary-text-color);font-size:9px}.tabs{display:flex;gap:5px;margin:14px 0 10px}.tabs button,.nav button{border:1px solid var(--edge);border-radius:10px;background:transparent;color:var(--secondary-text-color);cursor:pointer}.tabs button{flex:1;padding:8px}.tabs button.active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--primary-text-color)}.summary{display:grid;grid-template-columns:1fr repeat(3,auto);align-items:center;gap:7px}.day{text-transform:capitalize;font-size:14px;font-weight:800}.stat{min-width:55px;padding:5px 7px;border-radius:10px;background:color-mix(in srgb,var(--surface-local) 90%,var(--accent) 10%);text-align:center}.stat span{display:block;color:var(--secondary-text-color);font-size:7px}.stat b{font-size:11px}.chart{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));align-items:end;gap:4px;height:150px;margin-top:8px;padding-top:24px;border-bottom:1px solid var(--edge);background:repeating-linear-gradient(to bottom,transparent 0 30px,var(--edge) 31px,transparent 32px)}.bar-wrap{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:125px;min-width:0;padding:0;border:0;background:transparent;cursor:pointer}.bar-wrap i{display:block;width:100%;height:var(--h);min-height:7px;border-radius:5px 5px 1px 1px;background:color-mix(in srgb,var(--danger) calc(var(--ratio)*100%),var(--good));transition:filter .15s,transform .15s}.bar-wrap:hover i,.bar-wrap:focus i{filter:brightness(1.2);transform:scaleX(1.2)}.bar-wrap.current i{outline:2px solid var(--primary-text-color);outline-offset:2px}.bar-wrap.min i{box-shadow:0 0 10px color-mix(in srgb,var(--good) 60%,transparent)}.bar-wrap.max i{box-shadow:0 0 10px color-mix(in srgb,var(--danger) 60%,transparent)}.bar-wrap small{height:13px;margin-top:4px;color:var(--secondary-text-color);font-size:7px}.tip{position:absolute;z-index:5;bottom:104px;display:none;padding:5px 7px;border:1px solid var(--accent);border-radius:8px;background:var(--surface-local);font-size:9px;white-space:nowrap}.bar-wrap:hover .tip,.bar-wrap:focus .tip{display:block}.nav{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:9px}.nav button{display:grid;place-items:center;width:30px;height:28px}.nav span{min-width:70px;text-align:center;color:var(--secondary-text-color);font-size:9px}.empty{display:flex;align-items:center;justify-content:center;gap:8px;height:150px;color:var(--secondary-text-color)}@media(max-width:600px){ha-card{padding:12px 9px}.price b{font-size:25px}.source{font-size:7px}.summary{gap:3px}.stat{min-width:43px;padding:4px}.chart{gap:2px}.bar-wrap small{font-size:6px}.day{font-size:11px}}
    </style><ha-card><div class="head"><div class="price"><ha-icon icon="mdi:flash"></ha-icon><div><b>${this._fmt(data.current)}</b> <small>kr/kWh</small><div class="meta">Aktuel samlet elpris</div></div></div><span class="source">${data.source}</span></div><div class="tabs"><button data-tab="today" class="${this._tab === "today" ? "active" : ""}">I dag</button><button data-tab="tomorrow" class="${this._tab === "tomorrow" ? "active" : ""}">I morgen${data.tomorrowOfficial ? "" : " · forecast"}</button><button data-tab="forecast" class="${this._tab === "forecast" ? "active" : ""}">Forecast</button></div><div class="summary"><div class="day">${this._date(points)}</div><div class="stat"><span>LAV</span><b>${this._fmt(min)}</b></div><div class="stat"><span>SNIT</span><b>${this._fmt(avg)}</b></div><div class="stat"><span>HØJ</span><b>${this._fmt(max)}</b></div></div>${this._bars(points)}${this._tab === "forecast" ? `<div class="nav"><button data-dir="-1"><ha-icon icon="mdi:chevron-left"></ha-icon></button><span>Dag ${Math.min(this._forecastDay + 1, forecastDays || 1)} af ${forecastDays || 1}</span><button data-dir="1"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>` : ""}</ha-card>`;
    this.shadowRoot.querySelectorAll("[data-tab]").forEach(button => button.onclick = () => { this._tab = button.dataset.tab; if (this._tab === "forecast") this._forecastDay = 0; this._render(); });
    this.shadowRoot.querySelectorAll("[data-dir]").forEach(button => button.onclick = () => { this._forecastDay += Number(button.dataset.dir); this._render(); });
  }
}

if (!customElements.get("ha-electricity-price-card-editor")) customElements.define("ha-electricity-price-card-editor", HAElectricityPriceCardEditor);
if (!customElements.get("ha-electricity-price-card")) customElements.define("ha-electricity-price-card", HAElectricityPriceCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "ha-electricity-price-card", name: "HA Electricity Price Card", description: "Samlet elpriskort til Strømligning og Energi Data Service", preview: true });
console.info(`%c HA ELECTRICITY PRICE CARD %c v${VERSION} `, "color:white;background:#357fc4;font-weight:700", "color:#69c4ff;background:#161b22");
