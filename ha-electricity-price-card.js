const VERSION = "0.2.2";

class HAElectricityPriceCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }
  _change(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }
  _render() {
    if (!this._config) return;
    this.innerHTML = `<style>.row{display:grid;grid-template-columns:150px 1fr;align-items:center;gap:12px;margin:12px 0}select,input{width:100%;padding:8px;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color)}</style>
      <div class="row"><label>Datakilde</label><select data-key="source"><option value="auto">Automatisk</option><option value="stromligning">Strømligning</option><option value="energidataservice">Energi Data Service</option></select></div>
      <div class="row"><label>Strømligning pris</label><input data-key="stromligning_current"></div>
      <div class="row"><label>Strømligning i morgen</label><input data-key="stromligning_tomorrow"></div>
      <div class="row"><label>Strømligning forecast</label><input data-key="stromligning_forecast"></div>
      <div class="row"><label>Energi Data Service</label><input data-key="energidataservice"></div>`;
    this.querySelectorAll("select,input").forEach((el) => {
      el.value =
        this._config[el.dataset.key] ||
        (el.dataset.key === "source" ? "auto" : "");
      el.onchange = () => this._change(el.dataset.key, el.value);
    });
  }
}

class HAElectricityPriceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._tab = "today";
    this._forecastDay = 0;
    this._sig = "";
  }
  static getStubConfig() {
    return {
      source: "auto",
      energidataservice: "sensor.energi_data_service",
      stromligning_current: "sensor.stromligning_current_price_vat",
      stromligning_tomorrow:
        "binary_sensor.stromligning_tomorrow_available_vat",
      stromligning_forecast: "sensor.stromligning_forecasts_vat",
    };
  }
  static getConfigElement() {
    return document.createElement("ha-electricity-price-card-editor");
  }
  setConfig(config) {
    this._config = { ...HAElectricityPriceCard.getStubConfig(), ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    const ids = [
      this._config.energidataservice,
      this._config.stromligning_current,
      this._config.stromligning_tomorrow,
      this._config.stromligning_forecast,
    ];
    const sig = JSON.stringify(
      ids.map((id) => [
        id,
        hass?.states?.[id]?.state,
        hass?.states?.[id]?.last_updated,
      ]),
    );
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }
  getCardSize() {
    return 4;
  }
  getGridOptions() {
    return { columns: 12, rows: 4, min_columns: 6 };
  }
  _entity(id) {
    return this._hass?.states?.[id];
  }
  _source() {
    const requested = this._config.source || "auto";
    if (requested !== "auto") return requested;
    if (
      this._entity(this._config.stromligning_current)?.attributes?.prices
        ?.length
    )
      return "stromligning";
    return "energidataservice";
  }
  _point(item, fallbackHour = 0, dayOffset = 0) {
    const price = Number(item?.price ?? item);
    const raw = item?.start ?? item?.hour;
    const start = raw
      ? Date.parse(raw)
      : new Date(
          new Date().setHours(fallbackHour, 0, 0, 0) + dayOffset * 86400000,
        ).getTime();
    return Number.isFinite(price) && Number.isFinite(start)
      ? { price, start }
      : null;
  }
  _stromligning() {
    const todayEntity = this._entity(this._config.stromligning_current),
      tomorrowEntity = this._entity(this._config.stromligning_tomorrow),
      forecastEntity = this._entity(this._config.stromligning_forecast);
    const today = (todayEntity?.attributes?.prices || [])
      .map((p, i) => this._point(p, i))
      .filter(Boolean);
    const tomorrow = (tomorrowEntity?.attributes?.prices || [])
      .map((p, i) => this._point(p, i, 1))
      .filter(Boolean);
    const forecast = (forecastEntity?.attributes?.prices || [])
      .map((p, i) => this._point(p, i, 2))
      .filter(Boolean);
    return {
      source: "Strømligning",
      current: Number(todayEntity?.state),
      today,
      tomorrow,
      forecast,
      tomorrowOfficial: tomorrowEntity?.attributes?.forecast_data !== true,
    };
  }
  _eds() {
    const entity = this._entity(this._config.energidataservice),
      a = entity?.attributes || {};
    const make = (raw, simple, offset) =>
      (Array.isArray(raw) && raw.length ? raw : simple || [])
        .map((p, i) => this._point(p, i, offset))
        .filter(Boolean);
    return {
      source: "Energi Data Service",
      current: Number(a.current_price ?? entity?.state),
      today: make(a.raw_today, a.today, 0),
      tomorrow: make(a.raw_tomorrow, a.tomorrow, 1),
      forecast: (a.forecast || [])
        .map((p, i) => this._point(p, i, 2))
        .filter(Boolean),
      tomorrowOfficial: a.tomorrow_valid === true,
    };
  }
  _data() {
    return this._source() === "energidataservice"
      ? this._eds()
      : this._stromligning();
  }
  _days(points) {
    const map = new Map();
    points.forEach((p) => {
      const d = new Date(p.start),
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return [...map.values()].map((x) => x.sort((a, b) => a.start - b.start));
  }
  _selected(data) {
    if (this._tab === "today") return data.today;
    if (this._tab === "tomorrow") return data.tomorrow;
    const days = this._days(data.forecast);
    this._forecastDay = Math.max(
      0,
      Math.min(this._forecastDay, Math.max(0, days.length - 1)),
    );
    return days[this._forecastDay] || [];
  }
  _fmt(value) {
    return Number.isFinite(value)
      ? value.toLocaleString("da-DK", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";
  }
  _date(points) {
    if (!points.length) return "Ingen data";
    return new Date(points[0].start).toLocaleDateString("da-DK", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }
  _dayLabel(points) {
    const date = points.length ? new Date(points[0].start) : null;
    return date
      ? {
          weekday: date
            .toLocaleDateString("da-DK", { weekday: "short" })
            .replace(".", ""),
          date: date.toLocaleDateString("da-DK", {
            day: "2-digit",
            month: "2-digit",
          }),
        }
      : { weekday: "—", date: "—" };
  }
  _bars(points) {
    if (!points.length)
      return `<div class="empty"><ha-icon icon="mdi:chart-bar-off"></ha-icon><span>Ingen prisdata for denne dag</span></div>`;
    const values = points.map((p) => p.price),
      min = Math.min(...values),
      max = Math.max(...values),
      span = Math.max(0.01, max - min),
      now = Date.now();
    return `<div class="chart">${points
      .map((p) => {
        const h = 18 + ((p.price - min) / span) * 82,
          d = new Date(p.start),
          hour = String(d.getHours()).padStart(2, "0"),
          current = now >= p.start && now < p.start + 3600000,
          extreme = p.price === min ? "min" : p.price === max ? "max" : "";
        return `<button class="bar-wrap ${current ? "current" : ""} ${extreme}" aria-label="Klokken ${hour}, ${this._fmt(p.price)} kroner per kilowatt-time"><span class="tip">${hour}:00<br><b>${this._fmt(p.price)} kr.</b></span>${extreme ? `<em>${extreme === "min" ? "LAV" : "HØJ"}<b>${this._fmt(p.price)}</b></em>` : ""}<i style="--h:${h}%;--ratio:${(p.price - min) / span}"></i><small>${Number(hour) % 3 === 0 ? hour : ""}</small></button>`;
      })
      .join("")}</div>`;
  }
  _render() {
    if (!this.shadowRoot) return;
    const data = this._data(),
      forecast = this._days(data.forecast),
      points = this._selected(data),
      values = points.map((p) => p.price),
      min = values.length ? Math.min(...values) : NaN,
      max = values.length ? Math.max(...values) : NaN,
      avg = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : NaN;
    const dayPicker = `<div class="week-slot">${
      this._tab === "forecast"
        ? `<div class="week-nav"><button class="arrow" data-dir="-1" aria-label="Forrige dag"><ha-icon icon="mdi:chevron-left"></ha-icon></button><div class="days">${forecast
            .map((day, index) => {
              const label = this._dayLabel(day);
              return `<button data-day="${index}" class="day-choice ${index === this._forecastDay ? "active" : ""}"><b>${label.weekday}</b><span>${label.date}</span></button>`;
            })
            .join(
              "",
            )}</div><button class="arrow" data-dir="1" aria-label="Næste dag"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>`
        : ""
    }</div>`;
    const tab = (id, name, label, icon) =>
      `<button data-tab="${id}" class="${this._tab === id ? "active" : ""}"><span class="tab-copy"><b>${name}</b><small>${label}</small></span><ha-icon icon="${icon}"></ha-icon></button>`;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;--accent:var(--dashboard-accent,#62b5ff);--good:var(--dashboard-success,#50d6a0);--danger:var(--dashboard-danger,#ff6577);--edge:var(--dashboard-border-neutral,rgba(127,145,165,.22));--surface-local:var(--surface,var(--ha-card-background,var(--card-background-color,#101a28)))}*{box-sizing:border-box}button{font:inherit}ha-card{position:relative;overflow:hidden;padding:15px 16px 13px;border:1px solid var(--edge);border-left:4px solid var(--accent);border-radius:18px;background:var(--surface-local);color:var(--primary-text-color);box-shadow:var(--dashboard-card-shadow,0 8px 24px rgba(0,0,0,.14))}.head{display:flex;align-items:center;justify-content:space-between;gap:12px}.identity{display:flex;align-items:center;gap:9px}.icon{display:grid;place-items:center;width:35px;height:35px;border-radius:12px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}.icon ha-icon{--mdc-icon-size:23px}.eyebrow{display:block;color:var(--secondary-text-color);font-size:8px;font-weight:800;letter-spacing:.14em}.identity strong{display:block;margin-top:1px;font-size:15px}.price{text-align:right}.price-row{display:flex;align-items:baseline;justify-content:flex-end;gap:4px}.price b{font-size:29px;line-height:1}.price small,.meta{color:var(--secondary-text-color);font-size:9px}.source{display:inline-flex;align-items:center;gap:4px;margin-top:4px;color:var(--secondary-text-color);font-size:8px}.source:before{content:"";width:5px;height:5px;border-radius:50%;background:var(--good)}.tabs{display:flex;gap:5px;margin:12px 0 10px;padding:3px;border:1px solid var(--edge);border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 3%,transparent)}.tabs button{flex:1;padding:7px 6px;border:0;border-radius:9px;background:transparent;color:var(--secondary-text-color);font-size:11px;font-weight:700;cursor:pointer}.tabs button.active{background:color-mix(in srgb,var(--accent) 17%,transparent);color:var(--primary-text-color);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}.week-nav{display:grid;grid-template-columns:29px minmax(0,1fr) 29px;align-items:stretch;gap:5px;margin:0 0 10px}.days{display:grid;grid-template-columns:repeat(auto-fit,minmax(48px,1fr));gap:4px}.arrow,.day-choice{border:1px solid var(--edge);background:transparent;color:var(--secondary-text-color);cursor:pointer}.arrow{display:grid;place-items:center;padding:0;border-radius:10px}.arrow ha-icon{--mdc-icon-size:18px}.day-choice{min-width:0;padding:5px 2px;border-radius:9px}.day-choice b,.day-choice span{display:block}.day-choice b{text-transform:capitalize;font-size:10px}.day-choice span{margin-top:2px;font-size:7px}.day-choice.active{border-color:var(--accent);background:var(--accent);color:var(--text-primary-color,#fff);box-shadow:0 3px 10px color-mix(in srgb,var(--accent) 28%,transparent)}.summary{display:grid;grid-template-columns:minmax(110px,1fr) repeat(3,auto);align-items:center;gap:6px}.day{text-transform:capitalize;font-size:13px;font-weight:800}.stat{min-width:55px;padding:5px 7px;border:1px solid var(--edge);border-radius:10px;text-align:center}.stat span{display:block;color:var(--secondary-text-color);font-size:7px;font-weight:700}.stat b{font-size:10px}.chart{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));align-items:end;gap:4px;height:164px;margin-top:5px;padding-top:39px;border-bottom:1px solid var(--edge);background:repeating-linear-gradient(to bottom,transparent 0 31px,color-mix(in srgb,var(--edge) 65%,transparent) 32px,transparent 33px)}.bar-wrap{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:124px;min-width:0;padding:0;border:0;background:transparent;cursor:pointer}.bar-wrap i{display:block;width:100%;height:var(--h);min-height:7px;border-radius:5px 5px 2px 2px;background:color-mix(in srgb,var(--danger) calc(var(--ratio)*100%),var(--good));transition:filter .15s,transform .15s}.bar-wrap:hover i,.bar-wrap:focus-visible i{filter:brightness(1.15);transform:scaleX(1.18)}.bar-wrap.current i{outline:2px solid var(--primary-text-color);outline-offset:2px}.bar-wrap small{height:12px;margin-top:4px;color:var(--secondary-text-color);font-size:7px}.bar-wrap em{position:absolute;z-index:2;top:-35px;display:flex;flex-direction:column;align-items:center;padding:3px 5px;border:1px solid currentColor;border-radius:7px;background:var(--surface-local);font-size:6px;font-style:normal;font-weight:800;line-height:1.1;white-space:nowrap}.bar-wrap em b{font-size:8px}.bar-wrap.min em{color:var(--good)}.bar-wrap.max em{color:var(--danger)}.tip{position:absolute;z-index:5;bottom:105px;display:none;padding:5px 7px;border:1px solid var(--accent);border-radius:8px;background:var(--surface-local);box-shadow:0 5px 14px rgba(0,0,0,.2);font-size:9px;white-space:nowrap}.bar-wrap:hover .tip,.bar-wrap:focus-visible .tip{display:block}.empty{display:flex;align-items:center;justify-content:center;gap:8px;height:164px;color:var(--secondary-text-color)}@media(max-width:600px){ha-card{padding:12px 8px 10px}.icon{width:31px;height:31px}.identity strong{font-size:13px}.price b{font-size:24px}.tabs{margin-top:10px}.days{gap:2px}.day-choice{padding:5px 1px}.day-choice b{font-size:9px}.day-choice span{font-size:6px}.summary{grid-template-columns:1fr repeat(3,43px);gap:3px}.stat{min-width:0;padding:4px 2px}.day{font-size:10px}.chart{gap:2px}.bar-wrap small{font-size:6px}.bar-wrap em{padding:2px 3px}.bar-wrap em b{font-size:7px}}
      ha-card{height:405px}.tabs{height:62px;gap:10px;margin:12px 0 10px;padding:0;border:0;background:transparent}.tabs button{position:relative;display:grid;grid-template-columns:1fr auto;grid-template-rows:1fr 1fr;height:62px;overflow:hidden;padding:6px 8px;border:1px solid var(--edge);border-left:3px solid color-mix(in srgb,var(--edge) 72%,transparent);border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);text-align:left}.tabs button.active{border-color:var(--edge);border-left-color:var(--accent);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 24%,transparent),color-mix(in srgb,var(--primary-text-color) 2%,transparent));box-shadow:none}.tab-copy{position:relative;z-index:3;align-self:center}.tab-copy b,.tab-copy small{display:block}.tab-copy b{color:var(--primary-text-color);font-size:18px;line-height:1.05}.tab-copy small{margin-top:3px;color:var(--secondary-text-color);font-size:12px;white-space:nowrap}.tabs button em{position:relative;z-index:4;align-self:start;padding:2px 6px;border-radius:999px;background:var(--accent);color:var(--text-primary-color,#fff);font-size:7px;font-style:normal;font-weight:800;letter-spacing:.08em}.tabs button>ha-icon{position:absolute;right:-8px;bottom:-8px;color:var(--accent);opacity:.18;--mdc-icon-size:38px}.tabs button.active>ha-icon{animation:tabIconDrift 5s ease-in-out infinite;opacity:.22}.week-slot{height:48px;margin-bottom:10px}.week-nav{height:48px;margin:0}.day-choice{border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent)}@keyframes tabIconDrift{0%,100%{transform:translate(0,0) scale(1) rotate(0);opacity:.14}50%{transform:translate(-6px,-4px) scale(1.05) rotate(-4deg);opacity:.24}}@media(max-width:600px){ha-card{height:389px}.tabs{height:54px;gap:5px}.tabs button{height:54px;padding:5px 6px}.tab-copy b{font-size:13px}.tab-copy small{font-size:8px}.tabs button em{padding:2px 4px;font-size:5px}.tabs button>ha-icon{--mdc-icon-size:32px}.week-slot,.week-nav{height:44px}.week-slot{margin-bottom:7px}}
    </style><ha-card><div class="head"><div class="identity"><span class="icon"><ha-icon icon="mdi:flash"></ha-icon></span><div><span class="eyebrow">ENERGI</span><strong>Strømpris</strong></div></div><div class="price"><div class="price-row"><b>${this._fmt(data.current)}</b><small>kr/kWh</small></div><span class="source">${data.source}</span></div></div><div class="tabs">${tab("today", "I dag", "Aktiv fane", "mdi:calendar-today")}${tab("tomorrow", "I morgen", data.tomorrowOfficial ? "Næste døgn" : "Prisforecast", "mdi:calendar-arrow-right")}${tab("forecast", "Uge", "Fremtidige priser", "mdi:calendar-week")}</div>${dayPicker}<div class="summary"><div class="day">${this._date(points)}</div><div class="stat"><span>LAV</span><b>${this._fmt(min)}</b></div><div class="stat"><span>SNIT</span><b>${this._fmt(avg)}</b></div><div class="stat"><span>HØJ</span><b>${this._fmt(max)}</b></div></div>${this._bars(points)}</ha-card>`;
    this.shadowRoot.querySelectorAll("[data-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          this._tab = button.dataset.tab;
          if (this._tab === "forecast") this._forecastDay = 0;
          this._render();
        }),
    );
    this.shadowRoot.querySelectorAll("[data-dir]").forEach(
      (button) =>
        (button.onclick = () => {
          this._forecastDay += Number(button.dataset.dir);
          this._render();
        }),
    );
    this.shadowRoot.querySelectorAll("[data-day]").forEach(
      (button) =>
        (button.onclick = () => {
          this._forecastDay = Number(button.dataset.day);
          this._render();
        }),
    );
  }
}

if (!customElements.get("ha-electricity-price-card-editor"))
  customElements.define(
    "ha-electricity-price-card-editor",
    HAElectricityPriceCardEditor,
  );
if (!customElements.get("ha-electricity-price-card"))
  customElements.define("ha-electricity-price-card", HAElectricityPriceCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-electricity-price-card",
  name: "HA Electricity Price Card",
  description: "Samlet elpriskort til Strømligning og Energi Data Service",
  preview: true,
});
console.info(
  `%c HA ELECTRICITY PRICE CARD %c v${VERSION} `,
  "color:white;background:#357fc4;font-weight:700",
  "color:#69c4ff;background:#161b22",
);
