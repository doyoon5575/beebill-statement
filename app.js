(function () {
  const STORAGE_KEY = "beebill.statement.v2";
  const LEGACY_STORAGE_KEY = "beebill.statement.v1";

  const DEFAULT_BUSINESS_PROFILE = {
    business_name: "꿀벌빵",
    representative_name: "김도윤",
    business_registration_number: "",
    phone: "010-0000-0000",
    address: "",
    email: "",
    business_type: "",
    business_item: "",
    bank_name: "",
    bank_account: "",
    account_holder: "",
    seal_image_url: ""
  };

  const app = document.getElementById("app");

  const state = {
    view: "home",
    editingStatementId: null,
    editingCustomerId: null,
    editingProductId: null,
    search: "",
    statusFilter: "all",
    monthFilter: currentMonth(),
    statement: null
  };

  let store = loadStore();
  state.statement = createBlankStatement();

  function loadStore() {
    const fallback = {
      customers: [],
      products: defaultProducts(),
      statements: [],
      businessProfile: { ...DEFAULT_BUSINESS_PROFILE }
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!saved) return fallback;
      const parsed = JSON.parse(saved);
      return normalizeStore(parsed, fallback);
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  }

  function normalizeStore(parsed, fallback) {
    const businessProfile = normalizeBusinessProfile(parsed.businessProfile || parsed.supplier || {});
    const products = Array.isArray(parsed.products) && parsed.products.length
      ? parsed.products.map(normalizeProduct)
      : fallback.products;
    const customers = Array.isArray(parsed.customers)
      ? parsed.customers.map(normalizeCustomer)
      : [];
    const statements = Array.isArray(parsed.statements)
      ? parsed.statements.map(normalizeStatement)
      : [];

    return { customers, products, statements, businessProfile };
  }

  function defaultProducts() {
    return [
      normalizeProduct({
        id: uid("product"),
        name: "꿀벌빵",
        spec: "12개입",
        unit: "박스",
        retail_price: 29000,
        default_commission_rate: 30,
        price_mode: "auto",
        memo: "",
        created_at: new Date().toISOString()
      }),
      normalizeProduct({
        id: uid("product"),
        name: "꿀벌빵",
        spec: "5개입",
        unit: "박스",
        retail_price: 12000,
        default_commission_rate: 30,
        price_mode: "auto",
        memo: "",
        created_at: new Date().toISOString()
      })
    ];
  }

  function normalizeBusinessProfile(input) {
    return {
      ...DEFAULT_BUSINESS_PROFILE,
      ...input,
      business_name: input.business_name || input.company || DEFAULT_BUSINESS_PROFILE.business_name,
      representative_name: input.representative_name || input.representative || DEFAULT_BUSINESS_PROFILE.representative_name,
      business_registration_number: input.business_registration_number || input.businessNo || "",
      phone: input.phone || DEFAULT_BUSINESS_PROFILE.phone,
      address: input.address || ""
    };
  }

  function normalizeCustomer(customer) {
    return {
      id: customer.id || uid("customer"),
      name: customer.name || "",
      manager: customer.manager || "",
      phone: customer.phone || "",
      address: customer.address || "",
      default_commission_rate: parseNumber(customer.default_commission_rate),
      memo: customer.memo || "",
      created_at: customer.created_at || new Date().toISOString(),
      updated_at: customer.updated_at || customer.created_at || new Date().toISOString()
    };
  }

  function normalizeProduct(product) {
    const retailPrice = parseNumber(product.retail_price ?? product.default_price);
    const defaultRate = parseNumber(product.default_commission_rate);
    const priceMode = product.price_mode === "manual" ? "manual" : "auto";
    const defaultSupplyPrice = priceMode === "manual"
      ? parseNumber(product.default_supply_price ?? product.default_price)
      : calculateSupplyPrice(retailPrice, defaultRate);
    return {
      id: product.id || uid("product"),
      name: product.name || "",
      spec: product.spec || "",
      unit: product.unit || "박스",
      retail_price: retailPrice,
      default_commission_rate: defaultRate,
      default_supply_price: defaultSupplyPrice,
      price_mode: priceMode,
      memo: product.memo || "",
      created_at: product.created_at || new Date().toISOString(),
      updated_at: product.updated_at || product.created_at || new Date().toISOString()
    };
  }

  function normalizeStatement(statement) {
    const normalized = {
      ...statement,
      id: statement.id || uid("statement"),
      customer_id: statement.customer_id || "",
      customer_name: statement.customer_name || "",
      customer_manager: statement.customer_manager || "",
      customer_phone: statement.customer_phone || "",
      customer_address: statement.customer_address || "",
      customer_default_commission_rate: parseNumber(statement.customer_default_commission_rate),
      issue_date: statement.issue_date || today(),
      delivery_date: statement.delivery_date || statement.issue_date || today(),
      vat_mode: statement.vat_mode || "none",
      memo: statement.memo || "",
      show_seal: statement.show_seal !== false,
      show_price_details: Boolean(statement.show_price_details),
      status: statement.status || "draft",
      sent_method: statement.sent_method || "",
      sent_at: statement.sent_at || "",
      pdf_url: statement.pdf_url || "",
      jpg_url: statement.jpg_url || "",
      created_at: statement.created_at || new Date().toISOString(),
      updated_at: statement.updated_at || statement.created_at || new Date().toISOString(),
      items: Array.isArray(statement.items) && statement.items.length
        ? statement.items.map(normalizeItem)
        : [normalizeItem({})]
    };

    const legacySupplier = statement.supplier || {};
    normalized.business_name = statement.business_name || legacySupplier.company || DEFAULT_BUSINESS_PROFILE.business_name;
    normalized.representative_name = statement.representative_name || legacySupplier.representative || DEFAULT_BUSINESS_PROFILE.representative_name;
    normalized.business_registration_number = statement.business_registration_number || legacySupplier.businessNo || "";
    normalized.supplier_phone = statement.supplier_phone || legacySupplier.phone || "";
    normalized.supplier_address = statement.supplier_address || legacySupplier.address || "";
    normalized.supplier_email = statement.supplier_email || "";
    normalized.business_type = statement.business_type || "";
    normalized.business_item = statement.business_item || "";
    normalized.bank_name = statement.bank_name || "";
    normalized.bank_account = statement.bank_account || "";
    normalized.account_holder = statement.account_holder || "";
    normalized.seal_image_url = statement.seal_image_url || "";

    const totals = calculate(normalized);
    normalized.subtotal = totals.subtotal;
    normalized.vat = totals.vat;
    normalized.total = totals.total;
    return normalized;
  }

  function normalizeItem(item) {
    const normalized = {
      id: item.id || uid("item"),
      product_name: item.product_name || item.name || "",
      spec: item.spec || "",
      unit: item.unit || "박스",
      retail_price: parseNumber(item.retail_price ?? item.unit_price),
      commission_rate: parseNumber(item.commission_rate),
      commission_amount: parseNumber(item.commission_amount),
      price_mode: item.price_mode === "manual" ? "manual" : "auto",
      supply_unit_price: parseNumber(item.supply_unit_price ?? item.unit_price),
      quantity: parseNumber(item.quantity) || 1,
      retail_total: parseNumber(item.retail_total),
      supply_total: parseNumber(item.supply_total),
      amount: parseNumber(item.amount)
    };
    return updateItemDerived(normalized);
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function today() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function currentMonth() {
    return today().slice(0, 7);
  }

  function createBlankItem(overrides = {}) {
    const product = store.products[0];
    const commissionRate = parseNumber(overrides.commission_rate ?? product?.default_commission_rate);
    const item = {
      id: uid("item"),
      product_name: product ? product.name : "",
      spec: product ? product.spec : "",
      unit: product ? product.unit : "박스",
      retail_price: product ? Number(product.retail_price) : 0,
      commission_rate: commissionRate,
      price_mode: product?.price_mode || "auto",
      supply_unit_price: product ? Number(product.default_supply_price) : 0,
      quantity: 1,
      ...overrides
    };
    return updateItemDerived(item);
  }

  function createBlankStatement() {
    const issueDate = today();
    const profile = store.businessProfile;
    return {
      id: uid("statement"),
      statement_no: nextStatementNo(issueDate),
      customer_id: "",
      customer_name: "",
      customer_manager: "",
      customer_phone: "",
      customer_address: "",
      customer_default_commission_rate: 0,
      issue_date: issueDate,
      delivery_date: issueDate,
      business_name: profile.business_name,
      representative_name: profile.representative_name,
      business_registration_number: profile.business_registration_number,
      supplier_phone: profile.phone,
      supplier_address: profile.address,
      supplier_email: profile.email,
      business_type: profile.business_type,
      business_item: profile.business_item,
      bank_name: profile.bank_name,
      bank_account: profile.bank_account,
      account_holder: profile.account_holder,
      seal_image_url: profile.seal_image_url,
      show_seal: Boolean(profile.seal_image_url),
      show_price_details: false,
      vat_mode: "none",
      memo: "",
      status: "draft",
      sent_method: "",
      sent_at: "",
      pdf_url: "",
      jpg_url: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [createBlankItem()]
    };
  }

  function nextStatementNo(date) {
    const compact = date.replaceAll("-", "");
    const count = store.statements.filter((statement) => statement.issue_date === date).length + 1;
    return `${compact}-${String(count).padStart(3, "0")}`;
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value || "").replace(/[^\d.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundWon(value) {
    return Math.round(Number(value) || 0);
  }

  function roundRate(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function money(value) {
    return `${roundWon(value).toLocaleString("ko-KR")}원`;
  }

  function numberInput(value, decimals = false) {
    const parsed = parseNumber(value);
    if (!parsed) return "";
    return decimals ? String(parsed) : roundWon(parsed).toLocaleString("ko-KR");
  }

  function percent(value) {
    return `${roundRate(value).toLocaleString("ko-KR")}%`;
  }

  function productOptionValue(product) {
    return `${product.name} | ${product.spec || "규격 없음"} | 소비자가 ${money(product.retail_price)} | 공급가 ${money(product.default_supply_price)}`;
  }

  function plainMoney(value) {
    return String(roundWon(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeFilePart(value) {
    return String(value || "거래처")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "")
      .slice(0, 36) || "거래처";
  }

  function calculateSupplyPrice(retailPrice, commissionRate) {
    const commission = roundWon(parseNumber(retailPrice) * parseNumber(commissionRate) / 100);
    return roundWon(parseNumber(retailPrice) - commission);
  }

  function updateItemDerived(item) {
    const retailPrice = roundWon(item.retail_price);
    const quantity = parseNumber(item.quantity);
    let supplyUnitPrice;
    let commissionAmount;
    let commissionRate;

    if (item.price_mode === "manual") {
      supplyUnitPrice = roundWon(item.supply_unit_price);
      commissionAmount = roundWon(retailPrice - supplyUnitPrice);
      commissionRate = retailPrice > 0 ? roundRate((commissionAmount / retailPrice) * 100) : 0;
    } else {
      commissionRate = parseNumber(item.commission_rate);
      commissionAmount = roundWon(retailPrice * commissionRate / 100);
      supplyUnitPrice = roundWon(retailPrice - commissionAmount);
    }

    item.retail_price = retailPrice;
    item.quantity = quantity;
    item.commission_rate = commissionRate;
    item.commission_amount = commissionAmount;
    item.supply_unit_price = supplyUnitPrice;
    item.retail_total = roundWon(retailPrice * quantity);
    item.supply_total = roundWon(supplyUnitPrice * quantity);
    item.amount = item.supply_total;
    return item;
  }

  function calculate(statement) {
    const baseAmount = statement.items.reduce((sum, item) => {
      return sum + updateItemDerived({ ...item }).supply_total;
    }, 0);

    if (statement.vat_mode === "exclusive") {
      const vat = roundWon(baseAmount * 0.1);
      return { subtotal: baseAmount, vat, total: baseAmount + vat };
    }

    if (statement.vat_mode === "inclusive") {
      const subtotal = roundWon(baseAmount / 1.1);
      const vat = baseAmount - subtotal;
      return { subtotal, vat, total: baseAmount };
    }

    return { subtotal: baseAmount, vat: 0, total: baseAmount };
  }

  function statusLabel(status) {
    if (status === "sent") return "발송완료";
    if (status === "generated") return "생성완료";
    return "작성중";
  }

  function setView(view) {
    state.view = view;
    render();
  }

  function showToast(message) {
    const prior = document.querySelector(".toast");
    if (prior) prior.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2800);
  }

  function fitPreviewPaper() {
    window.requestAnimationFrame(() => {
      const frame = app.querySelector("[data-preview-frame]");
      const scaleLayer = app.querySelector("[data-preview-scale]");
      const paper = app.querySelector("#statement-paper");
      if (!frame || !scaleLayer || !paper) return;
      const available = Math.max(240, frame.clientWidth);
      const paperWidth = paper.offsetWidth || 794;
      const scale = Math.min(1, available / paperWidth);
      scaleLayer.style.setProperty("--preview-scale", String(scale));
      frame.style.height = `${Math.ceil((paper.offsetHeight || 1123) * scale)}px`;
    });
  }

  function render() {
    app.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand-lockup">
            <div class="brand-mark" aria-hidden="true">BB</div>
            <div class="brand-text">
              <h1 class="brand-title">꿀벌빵 거래명세서 생성기</h1>
              <p class="brand-subtitle">공급가 자동계산 · 도장 포함 A4 출력 · 발송기록</p>
            </div>
          </div>
          <nav class="nav" aria-label="주요 화면">
            ${navButton("home", "홈")}
            ${navButton("statement", "새 작성")}
            ${navButton("records", "기록")}
            ${navButton("customers", "거래처")}
            ${navButton("products", "상품")}
            ${navButton("business", "사업자")}
            ${navButton("data", "데이터")}
          </nav>
        </header>
        ${renderView()}
      </div>
    `;

    bindCommonEvents();
    if (state.view === "statement") bindStatementEvents();
    if (state.view === "records") bindRecordEvents();
    if (state.view === "data") bindDataEvents();
    if (state.view === "customers" || state.view === "products" || state.view === "business") bindManageEvents();
    fitPreviewPaper();
  }

  function navButton(view, label) {
    const current = state.view === view ? 'aria-current="page"' : "";
    return `<button type="button" data-view="${view}" ${current}>${label}</button>`;
  }

  function renderView() {
    if (state.view === "statement") return renderStatementView();
    if (state.view === "records") return renderRecordsView();
    if (state.view === "customers") return renderCustomersView();
    if (state.view === "products") return renderProductsView();
    if (state.view === "business") return renderBusinessView();
    if (state.view === "data") return renderDataView();
    return renderHomeView();
  }

  function monthlyStatements() {
    return store.statements.filter((statement) => statement.issue_date.slice(0, 7) === state.monthFilter);
  }

  function renderHomeView() {
    const monthRows = monthlyStatements();
    const monthTotal = monthRows.reduce((sum, statement) => sum + Number(statement.total || 0), 0);
    const sentRows = monthRows.filter((statement) => statement.status === "sent").length;
    const recentRows = [...store.statements]
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 5);

    return `
      <section class="home-actions" aria-label="빠른 실행">
        ${homeAction("statement", "+ 새 거래명세서 작성", "공급가 계산, A4 미리보기, PDF/JPG 저장", "new-statement")}
        ${homeAction("records", "기록 보기", "검색, 발송상태, 월별 합계")}
        ${homeAction("customers", "거래처 관리", "기본 수수료율 저장")}
        ${homeAction("products", "상품 관리", "소비자가, 수수료율, 공급가 저장")}
        ${homeAction("business", "사업자/도장 설정", "공급자 정보와 도장 이미지 저장")}
        ${homeAction("data", "데이터 백업/복원", "다른 휴대폰이나 브라우저로 기록 옮기기")}
      </section>
      <section class="summary-line" aria-label="이번 달 요약">
        <div class="metric"><span>이번 달</span><b>${state.monthFilter}</b></div>
        <div class="metric"><span>발행건수</span><b>${monthRows.length}건</b></div>
        <div class="metric"><span>발송완료</span><b>${sentRows}건</b></div>
        <div class="metric"><span>총 금액</span><b>${money(monthTotal)}</b></div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">최근 거래명세서</h2>
          <button type="button" class="ghost" data-view="records">전체 보기</button>
        </div>
        <div class="panel-body">
          ${recentRows.length ? renderRecordRows(recentRows, true) : '<div class="empty">저장된 거래명세서가 없습니다.</div>'}
        </div>
      </section>
    `;
  }

  function homeAction(view, title, subtitle, testId = "") {
    return `
      <button class="home-action" type="button" data-view="${view}" ${testId ? `data-testid="${testId}"` : ""}>
        <strong>${title}</strong>
        <span>${subtitle}</span>
      </button>
    `;
  }

  function renderStatementView() {
    const statement = state.statement;
    statement.items.forEach(updateItemDerived);
    const totals = calculate(statement);
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">거래명세서 작성</h2>
            <button type="button" class="ghost" data-action="reset-statement">초기화</button>
          </div>
          <div class="panel-body">
            ${renderStatementForm(statement)}
            <div class="totals-strip" aria-label="합계">
              <div class="total-box"><span>공급가액</span><b data-total="subtotal">${money(totals.subtotal)}</b></div>
              <div class="total-box"><span>부가세</span><b data-total="vat">${money(totals.vat)}</b></div>
              <div class="total-box"><span>합계금액</span><b data-total="total">${money(totals.total)}</b></div>
            </div>
            <div class="toolbar">
              <button type="button" class="ghost" data-action="save-draft">작성중 저장</button>
              <button type="button" class="secondary" data-action="download-jpg" data-testid="download-jpg">JPG 저장</button>
              <button type="button" class="primary" data-action="download-pdf" data-testid="download-pdf">PDF 저장</button>
              <button type="button" class="ghost full-mobile" data-action="mark-sent">발송완료 처리</button>
            </div>
          </div>
        </section>
        <section class="panel preview-panel">
          <div class="panel-header">
            <h2 class="panel-title">A4 미리보기</h2>
            <button type="button" class="ghost" data-action="print-preview">인쇄</button>
          </div>
          <div class="preview-shell">
            ${renderPreviewPaper(statement)}
          </div>
        </section>
      </div>
    `;
  }

  function renderStatementForm(statement) {
    return `
      <datalist id="customer-options">
        ${store.customers.map((customer) => `<option value="${escapeHtml(customer.name)}"></option>`).join("")}
      </datalist>
      <datalist id="product-options">
        ${store.products.map((product) => `<option value="${escapeHtml(productOptionValue(product))}"></option>`).join("")}
      </datalist>
      <div class="form-grid">
        <label>
          문서번호
          <input name="statement_no" value="${escapeHtml(statement.statement_no)}" data-statement-field="statement_no" />
        </label>
        <label>
          작성일
          <input type="date" name="issue_date" value="${escapeHtml(statement.issue_date)}" data-statement-field="issue_date" />
        </label>
        <label>
          납품일
          <input type="date" name="delivery_date" value="${escapeHtml(statement.delivery_date)}" data-statement-field="delivery_date" />
        </label>
        <label>
          부가세
          <select name="vat_mode" data-statement-field="vat_mode">
            ${option("none", "없음", statement.vat_mode)}
            ${option("inclusive", "포함", statement.vat_mode)}
            ${option("exclusive", "별도", statement.vat_mode)}
          </select>
        </label>
        <h3 class="form-section-title full">공급받는자</h3>
        <label>
          거래처명
          <input list="customer-options" name="customer_name" value="${escapeHtml(statement.customer_name)}" data-statement-field="customer_name" data-testid="customer-name" />
        </label>
        <label>
          담당자
          <input name="customer_manager" value="${escapeHtml(statement.customer_manager)}" data-statement-field="customer_manager" />
        </label>
        <label>
          연락처
          <input name="customer_phone" value="${escapeHtml(statement.customer_phone)}" data-statement-field="customer_phone" />
        </label>
        <label>
          주소
          <input name="customer_address" value="${escapeHtml(statement.customer_address)}" data-statement-field="customer_address" />
        </label>

        <h3 class="form-section-title full">공급자 정보</h3>
        ${renderSupplierInputs(statement)}
        <div class="toolbar full">
          <button type="button" class="ghost" data-action="save-business-from-statement">이 정보를 기본 사업자 정보로 저장</button>
        </div>

        <h3 class="form-section-title full">품목</h3>
        <div class="item-list full" data-item-list>
          ${statement.items.map(renderItemRow).join("")}
        </div>
        <button class="ghost full" type="button" data-action="add-item">+ 품목 추가</button>
        <div class="form-grid full compact-options">
          <label>
            도장 표시
            <select data-statement-field="show_seal">
              ${option("true", "표시", String(Boolean(statement.show_seal)))}
              ${option("false", "숨김", String(Boolean(statement.show_seal)))}
            </select>
          </label>
          <label>
            소비자가/수수료 표시
            <select data-statement-field="show_price_details">
              ${option("false", "숨김", String(Boolean(statement.show_price_details)))}
              ${option("true", "표시", String(Boolean(statement.show_price_details)))}
            </select>
          </label>
        </div>
        <label class="full">
          비고
          <textarea name="memo" data-statement-field="memo">${escapeHtml(statement.memo)}</textarea>
        </label>
      </div>
    `;
  }

  function renderSupplierInputs(statement) {
    const fields = [
      ["business_name", "상호명", "text"],
      ["representative_name", "대표자명", "text"],
      ["business_registration_number", "사업자등록번호", "text"],
      ["supplier_phone", "연락처", "text"],
      ["supplier_address", "주소", "text"],
      ["supplier_email", "이메일", "email"],
      ["business_type", "업태", "text"],
      ["business_item", "종목", "text"],
      ["bank_name", "은행명", "text"],
      ["bank_account", "계좌번호", "text"],
      ["account_holder", "예금주", "text"]
    ];

    return fields.map(([field, label, type]) => `
      <label class="${field === "supplier_address" ? "full" : ""}">
        ${label}
        <input type="${type}" value="${escapeHtml(statement[field])}" data-statement-field="${field}" />
      </label>
    `).join("");
  }

  function renderItemRow(item) {
    updateItemDerived(item);
    const isManual = item.price_mode === "manual";
    return `
      <div class="item-row" data-item-id="${item.id}">
        <label class="wide">
          품목명
          <input list="product-options" value="${escapeHtml(item.product_name)}" data-item-field="product_name" data-testid="item-name" />
        </label>
        <label>
          규격
          <input value="${escapeHtml(item.spec)}" data-item-field="spec" />
        </label>
        <label>
          단위
          <input value="${escapeHtml(item.unit)}" data-item-field="unit" />
        </label>
        <label>
          소비자가
          <input inputmode="numeric" value="${numberInput(item.retail_price)}" data-item-field="retail_price" data-money-field data-testid="item-retail-price" />
        </label>
        <label>
          수수료율
          <input inputmode="decimal" value="${escapeHtml(item.commission_rate)}" data-item-field="commission_rate" ${isManual ? "readonly" : ""} data-testid="item-commission-rate" />
        </label>
        <label>
          계산방식
          <select data-item-field="price_mode" data-testid="item-price-mode">
            ${option("auto", "자동계산", item.price_mode)}
            ${option("manual", "직접입력", item.price_mode)}
          </select>
        </label>
        <label>
          공급가
          <input inputmode="numeric" value="${numberInput(item.supply_unit_price)}" data-item-field="supply_unit_price" ${isManual ? "" : "readonly"} data-money-field data-testid="item-supply-price" />
        </label>
        <label>
          수량
          <input inputmode="decimal" value="${escapeHtml(item.quantity)}" data-item-field="quantity" data-testid="item-quantity" />
        </label>
        <button type="button" class="icon-button danger" data-action="remove-item" aria-label="품목 삭제">×</button>
        <div class="wide total-box" aria-live="polite">
          <span>금액</span>
          <b data-item-amount="${item.id}" data-testid="item-amount">${money(item.amount)}</b>
          <small data-item-detail="${item.id}">수수료 ${money(item.commission_amount)} · 공급단가 ${money(item.supply_unit_price)}</small>
        </div>
      </div>
    `;
  }

  function option(value, label, selected) {
    return `<option value="${value}" ${String(value) === String(selected) ? "selected" : ""}>${label}</option>`;
  }

  function renderStatementPaper(statement) {
    const totals = calculate(statement);
    const rows = statement.items.length ? statement.items : [createBlankItem()];
    const fillerRows = Math.max(0, 8 - rows.length);
    const showDetails = Boolean(statement.show_price_details);
    return `
      <article class="statement-paper" id="statement-paper" data-testid="statement-paper">
        <h2 class="paper-title">거 래 명 세 서</h2>
        <div class="paper-meta">
          <div><b>문서번호:</b> ${escapeHtml(statement.statement_no)}</div>
          <div><b>작성일자:</b> ${formatDateKo(statement.issue_date)}</div>
          <div><b>납품일자:</b> ${formatDateKo(statement.delivery_date)}</div>
        </div>
        <div class="paper-parties">
          <section class="party-box">
            <h3>공급받는자</h3>
            <dl>
              <dt>상호</dt><dd>${escapeHtml(statement.customer_name)}</dd>
              <dt>담당자</dt><dd>${escapeHtml(statement.customer_manager)}</dd>
              <dt>연락처</dt><dd>${escapeHtml(statement.customer_phone)}</dd>
              <dt>주소</dt><dd>${escapeHtml(statement.customer_address)}</dd>
            </dl>
          </section>
          <section class="party-box">
            <h3>공급자</h3>
            <dl>
              <dt>상호</dt><dd>${escapeHtml(statement.business_name)}</dd>
              <dt>대표자</dt><dd>${escapeHtml(statement.representative_name)}</dd>
              <dt>사업자번호</dt><dd>${escapeHtml(statement.business_registration_number)}</dd>
              <dt>연락처</dt><dd>${escapeHtml(statement.supplier_phone)}</dd>
              <dt>주소</dt><dd>${escapeHtml(statement.supplier_address)}</dd>
              <dt>업태/종목</dt><dd>${escapeHtml([statement.business_type, statement.business_item].filter(Boolean).join(" / "))}</dd>
            </dl>
          </section>
        </div>
        <table class="paper-table ${showDetails ? "with-price-details" : ""}">
          ${showDetails ? `
            <colgroup>
              <col style="width: 5%" />
              <col style="width: 17%" />
              <col style="width: 10%" />
              <col style="width: 7%" />
              <col style="width: 7%" />
              <col style="width: 11%" />
              <col style="width: 8%" />
              <col style="width: 10%" />
              <col style="width: 12%" />
              <col style="width: 13%" />
            </colgroup>
          ` : `
            <colgroup>
              <col style="width: 7%" />
              <col style="width: 28%" />
              <col style="width: 15%" />
              <col style="width: 10%" />
              <col style="width: 10%" />
              <col style="width: 14%" />
              <col style="width: 16%" />
            </colgroup>
          `}
          <thead>
            <tr>
              <th>No.</th>
              <th>품목명</th>
              <th>규격</th>
              <th>수량</th>
              <th>단위</th>
              ${showDetails ? "<th>소비자가</th><th>수수료율</th><th>수수료</th>" : ""}
              <th>공급단가</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((item, index) => renderPaperItemRow(item, index, showDetails)).join("")}
            ${Array.from({ length: fillerRows }).map(() => `
              <tr>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td>${showDetails ? "<td></td><td></td><td></td>" : ""}<td></td><td></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="paper-totals">
          <div class="memo-box">
            <b>비고</b><br />${escapeHtml(statement.memo)}
            ${statement.bank_name || statement.bank_account || statement.account_holder ? `
              <div class="account-line"><b>입금계좌</b> ${escapeHtml([statement.bank_name, statement.bank_account, statement.account_holder].filter(Boolean).join(" / "))}</div>
            ` : ""}
          </div>
          <div class="paper-total-lines">
            <div><span>공급가액</span><span>${money(totals.subtotal)}</span></div>
            <div><span>부가세</span><span>${money(totals.vat)}</span></div>
            <div><span>합계금액</span><span>${money(totals.total)}</span></div>
          </div>
        </div>
        <div class="paper-footer">
          <div>위와 같이 거래명세서를 발행합니다.</div>
          <div class="seal-line">
            <span>공급자: ${escapeHtml(statement.business_name)} &nbsp; (인)</span>
            ${statement.show_seal && statement.seal_image_url ? `<img src="${escapeHtml(statement.seal_image_url)}" alt="도장" class="seal-image" />` : '<span class="no-seal">도장 없음</span>'}
          </div>
        </div>
        <p class="paper-notice">본 거래명세서는 납품 및 거래내역 확인용이며, 세금계산서·현금영수증 등 세무 증빙은 별도 발급이 필요할 수 있습니다.</p>
      </article>
    `;
  }

  function renderPreviewPaper(statement) {
    return `
      <div class="paper-preview-frame" data-preview-frame>
        <div class="paper-preview-scale" data-preview-scale>
          ${renderStatementPaper(statement)}
        </div>
      </div>
    `;
  }

  function renderPaperItemRow(item, index, showDetails) {
    const computed = updateItemDerived({ ...item });
    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(computed.product_name)}</td>
        <td class="center">${escapeHtml(computed.spec)}</td>
        <td class="right">${escapeHtml(computed.quantity)}</td>
        <td class="center">${escapeHtml(computed.unit)}</td>
        ${showDetails ? `
          <td class="right money-cell">${money(computed.retail_price)}</td>
          <td class="right rate-cell">${percent(computed.commission_rate)}</td>
          <td class="right money-cell">${money(computed.commission_amount)}</td>
        ` : ""}
        <td class="right money-cell">${money(computed.supply_unit_price)}</td>
        <td class="right money-cell">${money(computed.amount)}</td>
      </tr>
    `;
  }

  function formatDateKo(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${year}년 ${month}월 ${day}일`;
  }

  function renderRecordsView() {
    const searched = filteredStatements();
    const monthRows = monthlyStatements();
    const monthTotal = monthRows.reduce((sum, statement) => sum + Number(statement.total || 0), 0);
    const customerCount = new Set(monthRows.map((statement) => statement.customer_name).filter(Boolean)).size;
    return `
      <section class="panel records-layout">
        <div class="panel-header">
          <h2 class="panel-title">거래명세서 기록</h2>
          <button type="button" class="primary" data-view="statement">+ 새 작성</button>
        </div>
        <div class="panel-body">
          <div class="search-row">
            <label>
              검색
              <input value="${escapeHtml(state.search)}" placeholder="거래처명, 날짜, 금액" data-record-search />
            </label>
            <label>
              상태
              <select data-status-filter>
                ${option("all", "전체", state.statusFilter)}
                ${option("draft", "작성중", state.statusFilter)}
                ${option("generated", "생성완료", state.statusFilter)}
                ${option("sent", "발송완료", state.statusFilter)}
              </select>
            </label>
            <label>
              월별 합계
              <input type="month" value="${escapeHtml(state.monthFilter)}" data-month-filter />
            </label>
          </div>
          <div data-record-summary>
            ${renderRecordSummary(customerCount, monthRows, monthTotal)}
          </div>
          <div data-record-results>
            ${searched.length ? renderRecordRows(searched, false) : '<div class="empty">검색 결과가 없습니다.</div>'}
          </div>
        </div>
      </section>
    `;
  }

  function renderRecordSummary(customerCount, monthRows, monthTotal) {
    return `
      <div class="summary-line">
        <div class="metric"><span>거래처</span><b>${customerCount}곳</b></div>
        <div class="metric"><span>발행건수</span><b>${monthRows.length}건</b></div>
        <div class="metric"><span>총 금액</span><b>${money(monthTotal)}</b></div>
        <div class="metric"><span>발송완료</span><b>${monthRows.filter((statement) => statement.status === "sent").length}건</b></div>
      </div>
    `;
  }

  function filteredStatements() {
    const term = state.search.trim().toLowerCase();
    return [...store.statements]
      .filter((statement) => {
        if (state.statusFilter !== "all" && statement.status !== state.statusFilter) return false;
        if (!term) return true;
        const haystack = [
          statement.customer_name,
          statement.issue_date,
          statement.delivery_date,
          statement.statement_no,
          statement.total,
          statusLabel(statement.status),
          statement.sent_method,
          itemSummary(statement.items)
        ].join(" ").toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)) || String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  function renderRecordRows(rows, compact) {
    return `
      <div class="record-list">
        ${rows.map((statement) => {
          const statusClass = statement.status === "sent" ? "sent" : statement.status === "draft" ? "draft" : "";
          return `
            <article class="record-row" data-statement-id="${statement.id}">
              <div>
                <p class="record-title">
                  <span>${escapeHtml(statement.issue_date)}</span>
                  <span>${escapeHtml(statement.customer_name || "거래처 미입력")}</span>
                  <span>${money(statement.total)}</span>
                  <span class="status-pill ${statusClass}">${statusLabel(statement.status)}</span>
                </p>
                <div class="record-meta">
                  <span>${escapeHtml(statement.statement_no)}</span>
                  <span>${escapeHtml(itemSummary(statement.items))}</span>
                  ${statement.sent_method ? `<span>${escapeHtml(statement.sent_method)}</span>` : ""}
                  ${statement.pdf_url ? `<span>${escapeHtml(statement.pdf_url)}</span>` : ""}
                  ${statement.jpg_url ? `<span>${escapeHtml(statement.jpg_url)}</span>` : ""}
                </div>
              </div>
              ${compact ? `
                <button type="button" class="ghost" data-action="load-record">열기</button>
              ` : `
                <div class="toolbar">
                  <button type="button" class="ghost" data-action="load-record">수정</button>
                  <button type="button" class="ghost" data-action="copy-record">복사 작성</button>
                  <button type="button" class="ghost" data-action="record-pdf">PDF 다시</button>
                  <button type="button" class="ghost" data-action="record-jpg">JPG 다시</button>
                  <button type="button" class="secondary" data-action="record-sent">발송완료</button>
                  <button type="button" class="danger" data-action="delete-record">삭제</button>
                </div>
              `}
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function itemSummary(items) {
    if (!items || !items.length) return "품목 없음";
    const first = updateItemDerived({ ...items[0] });
    const extra = items.length > 1 ? ` 외 ${items.length - 1}건` : "";
    return `${first.product_name || "품목"} ${money(first.supply_unit_price)}${extra}`;
  }

  function renderCustomersView() {
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">거래처 관리</h2>
          </div>
          <div class="panel-body">
            ${renderCustomerEditor()}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">거래처 목록</h2>
            <span class="status-pill">${store.customers.length}건</span>
          </div>
          <div class="panel-body">
            ${renderCustomerList()}
          </div>
        </section>
      </div>
    `;
  }

  function renderProductsView() {
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">상품 관리</h2>
          </div>
          <div class="panel-body">
            ${renderProductEditor()}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">상품 목록</h2>
            <span class="status-pill">${store.products.length}건</span>
          </div>
          <div class="panel-body">
            ${renderProductList()}
          </div>
        </section>
      </div>
    `;
  }

  function renderBusinessView() {
    const profile = store.businessProfile;
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">사업자 정보 설정</h2>
          </div>
          <div class="panel-body">
            <div class="form-grid" data-editor="business">
              ${businessField("business_name", "상호명", profile.business_name)}
              ${businessField("representative_name", "대표자명", profile.representative_name)}
              ${businessField("business_registration_number", "사업자등록번호", profile.business_registration_number)}
              ${businessField("phone", "연락처", profile.phone)}
              ${businessField("address", "주소", profile.address, "full")}
              ${businessField("email", "이메일", profile.email, "", "email")}
              ${businessField("business_type", "업태", profile.business_type)}
              ${businessField("business_item", "종목", profile.business_item)}
              ${businessField("bank_name", "은행명", profile.bank_name)}
              ${businessField("bank_account", "계좌번호", profile.bank_account)}
              ${businessField("account_holder", "예금주", profile.account_holder)}
              <label class="full">
                도장 이미지
                <input type="file" accept="image/png,image/jpeg" data-seal-upload />
              </label>
              <div class="toolbar full">
                <button type="button" class="primary" data-action="save-business">사업자 정보 저장</button>
                ${profile.seal_image_url ? '<button type="button" class="danger" data-action="remove-seal">도장 삭제</button>' : ""}
              </div>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">도장 미리보기</h2>
          </div>
          <div class="panel-body">
            ${profile.seal_image_url ? `<img src="${escapeHtml(profile.seal_image_url)}" alt="도장 미리보기" class="seal-preview" />` : '<div class="empty">등록된 도장 이미지가 없습니다.</div>'}
          </div>
        </section>
      </div>
    `;
  }

  function renderDataView() {
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">데이터 백업/복원</h2>
          </div>
          <div class="panel-body">
            <div class="empty">
              이 앱은 현재 브라우저에 데이터를 저장합니다. 데스크톱에서 저장한 기록을 휴대폰에서 보려면 백업 파일을 내보낸 뒤 휴대폰에서 가져오면 됩니다.
            </div>
            <div class="summary-line">
              <div class="metric"><span>거래명세서</span><b>${store.statements.length}건</b></div>
              <div class="metric"><span>거래처</span><b>${store.customers.length}곳</b></div>
              <div class="metric"><span>상품</span><b>${store.products.length}개</b></div>
              <div class="metric"><span>도장</span><b>${store.businessProfile.seal_image_url ? "있음" : "없음"}</b></div>
            </div>
            <div class="toolbar">
              <button type="button" class="primary" data-action="export-data" data-testid="export-data">백업 파일 저장</button>
              <label class="import-button">
                백업 파일 가져오기
                <input type="file" accept="application/json,.json" data-import-data data-testid="import-data" />
              </label>
            </div>
            <div class="total-box">
              <span>옮기는 방법</span>
              <small>1. 기존에 작성하던 PC/브라우저에서 이 화면의 백업 파일 저장을 누릅니다.<br />2. 저장된 JSON 파일을 카카오톡, 메일, 구글드라이브 등으로 휴대폰에 보냅니다.<br />3. 휴대폰에서 이 앱을 열고 백업 파일 가져오기를 누릅니다.</small>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">저장 방식 안내</h2>
          </div>
          <div class="panel-body">
            <div class="total-box">
              <span>현재 저장 위치</span>
              <b>이 브라우저 내부 저장소</b>
              <small>같은 주소라도 PC Chrome, 휴대폰 Safari, 휴대폰 Chrome은 저장소가 서로 다릅니다. 모든 기기에서 자동 동기화하려면 Supabase 같은 클라우드 DB 연결이 필요합니다.</small>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function businessField(name, label, value, className = "", type = "text") {
    return `
      <label class="${className}">
        ${label}
        <input type="${type}" name="${name}" value="${escapeHtml(value)}" />
      </label>
    `;
  }

  function renderCustomerEditor() {
    const editing = store.customers.find((customer) => customer.id === state.editingCustomerId) || {};
    return `
      <div class="form-grid" data-editor="customer">
        <label>
          거래처명
          <input name="name" value="${escapeHtml(editing.name)}" data-testid="manage-customer-name" />
        </label>
        <label>
          담당자
          <input name="manager" value="${escapeHtml(editing.manager)}" />
        </label>
        <label>
          연락처
          <input name="phone" value="${escapeHtml(editing.phone)}" />
        </label>
        <label>
          기본 수수료율
          <input inputmode="decimal" name="default_commission_rate" value="${escapeHtml(editing.default_commission_rate)}" />
        </label>
        <label class="full">
          주소
          <input name="address" value="${escapeHtml(editing.address)}" />
        </label>
        <label class="full">
          메모
          <textarea name="memo">${escapeHtml(editing.memo)}</textarea>
        </label>
        <div class="toolbar full">
          <button type="button" class="primary" data-action="save-customer">${editing.id ? "거래처 수정" : "거래처 저장"}</button>
          ${editing.id ? '<button type="button" class="ghost" data-action="cancel-customer-edit">취소</button>' : ""}
        </div>
      </div>
    `;
  }

  function renderProductEditor() {
    const editing = store.products.find((product) => product.id === state.editingProductId) || {};
    const preview = normalizeProduct(editing);
    return `
      <div class="form-grid" data-editor="product">
        <label>
          품목명
          <input name="name" value="${escapeHtml(editing.name)}" data-testid="manage-product-name" />
        </label>
        <label>
          규격
          <input name="spec" value="${escapeHtml(editing.spec)}" />
        </label>
        <label>
          단위
          <input name="unit" value="${escapeHtml(editing.unit || "박스")}" />
        </label>
        <label>
          소비자가
          <input inputmode="numeric" name="retail_price" value="${numberInput(editing.retail_price)}" data-money-field />
        </label>
        <label>
          기본 수수료율
          <input inputmode="decimal" name="default_commission_rate" value="${escapeHtml(editing.default_commission_rate ?? 30)}" />
        </label>
        <label>
          공급가 계산방식
          <select name="price_mode">
            ${option("auto", "자동계산", editing.price_mode || "auto")}
            ${option("manual", "직접입력", editing.price_mode || "auto")}
          </select>
        </label>
        <label>
          기본 공급가
          <input inputmode="numeric" name="default_supply_price" value="${numberInput(editing.default_supply_price || preview.default_supply_price)}" data-money-field />
        </label>
        <div class="total-box">
          <span>자동계산 공급가</span>
          <b>${money(calculateSupplyPrice(editing.retail_price, editing.default_commission_rate ?? 30))}</b>
        </div>
        <label class="full">
          메모
          <textarea name="memo">${escapeHtml(editing.memo)}</textarea>
        </label>
        <div class="toolbar full">
          <button type="button" class="primary" data-action="save-product">${editing.id ? "상품 수정" : "상품 저장"}</button>
          ${editing.id ? '<button type="button" class="ghost" data-action="cancel-product-edit">취소</button>' : ""}
        </div>
      </div>
    `;
  }

  function renderCustomerList() {
    if (!store.customers.length) return '<div class="empty">저장된 거래처가 없습니다.</div>';
    return `
      <div class="manage-list">
        ${store.customers.map((customer) => `
          <article class="manage-row" data-customer-id="${customer.id}">
            <div>
              <p class="manage-title">${escapeHtml(customer.name)}</p>
              <div class="manage-meta">
                <span>${escapeHtml(customer.manager || "담당자 없음")}</span>
                <span>${escapeHtml(customer.phone || "연락처 없음")}</span>
                <span>기본 수수료 ${percent(customer.default_commission_rate)}</span>
                <span>${escapeHtml(customer.address || "주소 없음")}</span>
              </div>
            </div>
            <div class="toolbar">
              <button type="button" class="ghost" data-action="edit-customer">수정</button>
              <button type="button" class="danger" data-action="delete-customer">삭제</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderProductList() {
    if (!store.products.length) return '<div class="empty">저장된 상품이 없습니다.</div>';
    return `
      <div class="manage-list">
        ${store.products.map((product) => `
          <article class="manage-row" data-product-id="${product.id}">
            <div>
              <p class="manage-title">${escapeHtml(product.name)} <span>${escapeHtml(product.spec)}</span></p>
              <div class="manage-meta">
                <span>소비자가 ${money(product.retail_price)}</span>
                <span>수수료 ${percent(product.default_commission_rate)}</span>
                <span>공급가 ${money(product.default_supply_price)}</span>
                <span>${escapeHtml(product.unit || "단위 없음")}</span>
              </div>
            </div>
            <div class="toolbar">
              <button type="button" class="ghost" data-action="edit-product">수정</button>
              <button type="button" class="danger" data-action="delete-product">삭제</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function bindCommonEvents() {
    app.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.view;
        if (view === "statement" && state.view !== "statement") {
          state.editingStatementId = null;
          state.statement = createBlankStatement();
        }
        setView(view);
      });
    });

    if (state.view === "home") {
      app.querySelectorAll('[data-action="load-record"]').forEach((button) => {
        button.addEventListener("click", () => handleRecordAction("load-record", button));
      });
    }
  }

  function bindStatementEvents() {
    app.querySelectorAll("[data-statement-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.statementField;
        if (field === "show_seal" || field === "show_price_details") {
          state.statement[field] = input.value === "true";
        } else {
          state.statement[field] = input.value;
        }
        if (field === "customer_name") fillCustomerIfMatched(input.value);
        if (field === "issue_date" && !state.editingStatementId) {
          state.statement.statement_no = nextStatementNo(input.value);
          const noInput = app.querySelector('[data-statement-field="statement_no"]');
          if (noInput) noInput.value = state.statement.statement_no;
        }
        refreshStatementOutput();
      });
      input.addEventListener("change", () => {
        const field = input.dataset.statementField;
        state.statement[field] = field === "show_seal" || field === "show_price_details" ? input.value === "true" : input.value;
        refreshStatementOutput();
      });
    });

    app.querySelectorAll("[data-item-field]").forEach((input) => {
      input.addEventListener("input", () => updateItemFromInput(input));
      input.addEventListener("change", () => updateItemFromInput(input, input.dataset.itemField === "price_mode"));
      input.addEventListener("blur", () => {
        if (input.dataset.moneyField !== undefined) {
          window.setTimeout(() => {
            input.value = numberInput(input.value);
          }, 0);
        }
      });
    });

    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleStatementAction(button.dataset.action, button));
    });
  }

  function updateItemFromInput(input, rerender = false) {
    const row = input.closest("[data-item-id]");
    const item = state.statement.items.find((candidate) => candidate.id === row.dataset.itemId);
    if (!item) return;
    const field = input.dataset.itemField;
    item[field] = field === "product_name" || field === "spec" || field === "unit" || field === "price_mode"
      ? input.value
      : parseNumber(input.value);

    if (field === "product_name") fillProductIfMatched(item, input.value, row);
    if (field === "price_mode") rerender = true;
    updateItemDerived(item);

    if (rerender) {
      render();
      return;
    }

    refreshItemRow(row, item);
    refreshStatementOutput();
  }

  function refreshItemRow(row, item) {
    const amount = row.querySelector(`[data-item-amount="${item.id}"]`);
    const detail = row.querySelector(`[data-item-detail="${item.id}"]`);
    const supply = row.querySelector('[data-item-field="supply_unit_price"]');
    const rate = row.querySelector('[data-item-field="commission_rate"]');
    if (amount) amount.textContent = money(item.amount);
    if (detail) detail.textContent = `수수료 ${money(item.commission_amount)} · 공급단가 ${money(item.supply_unit_price)}`;
    if (supply && document.activeElement !== supply) supply.value = numberInput(item.supply_unit_price);
    if (rate && document.activeElement !== rate) rate.value = item.commission_rate;
  }

  function fillCustomerIfMatched(value) {
    const customer = store.customers.find((candidate) => candidate.name === value);
    if (!customer) return;
    state.statement.customer_id = customer.id;
    state.statement.customer_manager = customer.manager || "";
    state.statement.customer_phone = customer.phone || "";
    state.statement.customer_address = customer.address || "";
    state.statement.customer_default_commission_rate = parseNumber(customer.default_commission_rate);

    if (state.statement.customer_default_commission_rate > 0) {
      state.statement.items.forEach((item) => {
        if (item.price_mode !== "manual") {
          item.commission_rate = state.statement.customer_default_commission_rate;
          updateItemDerived(item);
        }
      });
      app.querySelectorAll("[data-item-id]").forEach((row) => {
        const item = state.statement.items.find((candidate) => candidate.id === row.dataset.itemId);
        if (item) refreshItemRow(row, item);
      });
    }

    ["customer_manager", "customer_phone", "customer_address"].forEach((field) => {
      const input = app.querySelector(`[data-statement-field="${field}"]`);
      if (input) input.value = state.statement[field];
    });
  }

  function fillProductIfMatched(item, value, row) {
    const product = store.products.find((candidate) => productOptionValue(candidate) === value) || store.products.find((candidate) => candidate.name === value);
    if (!product) return;
    item.product_name = product.name || "";
    item.spec = product.spec || "";
    item.unit = product.unit || "";
    item.retail_price = Number(product.retail_price || 0);
    item.price_mode = product.price_mode || "auto";
    item.commission_rate = state.statement.customer_default_commission_rate > 0 ? state.statement.customer_default_commission_rate : Number(product.default_commission_rate || 0);
    item.supply_unit_price = item.price_mode === "manual" ? Number(product.default_supply_price || 0) : calculateSupplyPrice(item.retail_price, item.commission_rate);
    updateItemDerived(item);
    row.querySelector('[data-item-field="product_name"]').value = item.product_name;
    row.querySelector('[data-item-field="spec"]').value = item.spec;
    row.querySelector('[data-item-field="unit"]').value = item.unit;
    row.querySelector('[data-item-field="retail_price"]').value = numberInput(item.retail_price);
    row.querySelector('[data-item-field="commission_rate"]').value = item.commission_rate;
    row.querySelector('[data-item-field="price_mode"]').value = item.price_mode;
    row.querySelector('[data-item-field="supply_unit_price"]').value = numberInput(item.supply_unit_price);
  }

  function refreshStatementOutput() {
    state.statement.items.forEach(updateItemDerived);
    const totals = calculate(state.statement);
    ["subtotal", "vat", "total"].forEach((field) => {
      const node = app.querySelector(`[data-total="${field}"]`);
      if (node) node.textContent = money(totals[field]);
    });
    const preview = app.querySelector(".preview-shell");
    if (preview) {
      preview.innerHTML = renderPreviewPaper(state.statement);
      fitPreviewPaper();
    }
  }

  async function handleStatementAction(action, button) {
    if (action === "reset-statement") {
      state.editingStatementId = null;
      state.statement = createBlankStatement();
      render();
      return;
    }

    if (action === "add-item") {
      const rate = state.statement.customer_default_commission_rate || undefined;
      state.statement.items.push(createBlankItem({ commission_rate: rate }));
      render();
      return;
    }

    if (action === "remove-item") {
      const row = button.closest("[data-item-id]");
      if (state.statement.items.length === 1) {
        showToast("품목은 최소 1개가 필요합니다.");
        return;
      }
      state.statement.items = state.statement.items.filter((item) => item.id !== row.dataset.itemId);
      render();
      return;
    }

    if (action === "save-business-from-statement") {
      saveBusinessFromStatement();
      return;
    }

    if (action === "save-draft") {
      saveCurrentStatement("draft");
      showToast("작성중 상태로 저장했습니다.");
      render();
      return;
    }

    if (action === "download-jpg") {
      await downloadJpg(button);
      return;
    }

    if (action === "download-pdf") {
      await downloadPdf(button);
      return;
    }

    if (action === "mark-sent") {
      markCurrentSent();
      render();
      return;
    }

    if (action === "print-preview") {
      window.print();
    }
  }

  function validateStatement(statement) {
    if (!statement.customer_name.trim()) {
      showToast("거래처명을 입력해 주세요.");
      return false;
    }
    if (!statement.business_name.trim() || !statement.representative_name.trim()) {
      showToast("공급자 상호명과 대표자명을 입력해 주세요.");
      return false;
    }
    const validItems = statement.items.filter((item) => item.product_name.trim() && parseNumber(item.quantity) > 0);
    if (!validItems.length) {
      showToast("품목명과 수량을 입력해 주세요.");
      return false;
    }
    return true;
  }

  function saveCurrentStatement(status, files = {}) {
    const statement = state.statement;
    if (!validateStatement(statement)) return null;

    upsertCustomerFromStatement(statement);
    statement.items.forEach(updateItemDerived);
    const totals = calculate(statement);
    const now = new Date().toISOString();
    const row = {
      ...statement,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total,
      status: status || statement.status || "draft",
      pdf_url: files.pdf_url || statement.pdf_url || "",
      jpg_url: files.jpg_url || statement.jpg_url || "",
      updated_at: now,
      created_at: statement.created_at || now,
      items: statement.items.map((item) => ({ ...updateItemDerived({ ...item }) }))
    };

    const index = store.statements.findIndex((candidate) => candidate.id === row.id);
    if (index >= 0) {
      store.statements[index] = row;
    } else {
      store.statements.unshift(row);
    }
    state.editingStatementId = row.id;
    state.statement = { ...row, items: row.items.map((item) => ({ ...item })) };
    persist();
    return row;
  }

  function saveBusinessFromStatement() {
    store.businessProfile = {
      business_name: state.statement.business_name,
      representative_name: state.statement.representative_name,
      business_registration_number: state.statement.business_registration_number,
      phone: state.statement.supplier_phone,
      address: state.statement.supplier_address,
      email: state.statement.supplier_email,
      business_type: state.statement.business_type,
      business_item: state.statement.business_item,
      bank_name: state.statement.bank_name,
      bank_account: state.statement.bank_account,
      account_holder: state.statement.account_holder,
      seal_image_url: state.statement.seal_image_url || store.businessProfile.seal_image_url
    };
    persist();
    showToast("기본 사업자 정보로 저장했습니다.");
  }

  function upsertCustomerFromStatement(statement) {
    const name = statement.customer_name.trim();
    if (!name) return;
    const existing = store.customers.find((customer) => customer.id === statement.customer_id || customer.name === name);
    if (existing) {
      existing.name = name;
      existing.manager = statement.customer_manager;
      existing.phone = statement.customer_phone;
      existing.address = statement.customer_address;
      existing.updated_at = new Date().toISOString();
      statement.customer_id = existing.id;
      return;
    }
    const customer = {
      id: uid("customer"),
      name,
      manager: statement.customer_manager,
      phone: statement.customer_phone,
      address: statement.customer_address,
      default_commission_rate: 0,
      memo: "",
      created_at: new Date().toISOString()
    };
    store.customers.push(customer);
    statement.customer_id = customer.id;
  }

  function buildFileName(statement, extension) {
    const totals = calculate(statement);
    return `거래명세서_${safeFilePart(statement.customer_name)}_${statement.issue_date}_${plainMoney(totals.total)}원.${extension}`;
  }

  async function getStatementCanvas(targetStatement = state.statement) {
    if (!window.html2canvas) throw new Error("html2canvas 라이브러리를 불러오지 못했습니다.");
    const temp = document.createElement("div");
    temp.className = "offscreen-render";
    temp.innerHTML = renderStatementPaper(targetStatement);
    document.body.appendChild(temp);
    const paper = temp.querySelector("#statement-paper");
    if (!paper) throw new Error("미리보기 영역을 찾지 못했습니다.");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = await window.html2canvas(paper, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      logging: false,
      windowWidth: 1000
    });
    temp.remove();
    return canvas;
  }

  async function downloadJpg(button, targetStatement = state.statement) {
    const saved = targetStatement === state.statement ? saveCurrentStatement("generated") : targetStatement;
    if (!saved) return;
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "생성 중";
      }
      const canvas = await getStatementCanvas(saved);
      const fileName = buildFileName(saved, "jpg");
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      triggerDownload(blob, fileName);
      if (targetStatement === state.statement) {
        saveCurrentStatement("generated", { jpg_url: fileName });
        render();
      }
      showToast("JPG 파일을 저장했습니다.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "JPG 생성에 실패했습니다.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.action === "record-jpg" ? "JPG 다시" : "JPG 저장";
      }
    }
  }

  async function downloadPdf(button, targetStatement = state.statement) {
    const saved = targetStatement === state.statement ? saveCurrentStatement("generated") : targetStatement;
    if (!saved) return;
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "생성 중";
      }
      const canvas = await getStatementCanvas(saved);
      const image = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
      pdf.addImage(image, "JPEG", 0, 0, 210, 297);
      const fileName = buildFileName(saved, "pdf");
      pdf.save(fileName);
      if (targetStatement === state.statement) {
        saveCurrentStatement("generated", { pdf_url: fileName });
        render();
      }
      showToast("PDF 파일을 저장했습니다.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "PDF 생성에 실패했습니다.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.action === "record-pdf" ? "PDF 다시" : "PDF 저장";
      }
    }
  }

  function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function markCurrentSent() {
    const method = window.prompt("발송방법을 입력하세요. 예: 카카오톡, 문자, 이메일, 직접전달", state.statement.sent_method || "카카오톡");
    if (method === null) return;
    state.statement.sent_method = method.trim() || "직접전달";
    state.statement.sent_at = new Date().toISOString();
    saveCurrentStatement("sent");
    showToast("발송완료로 기록했습니다.");
  }

  function bindRecordEvents() {
    const search = app.querySelector("[data-record-search]");
    if (search) {
      search.addEventListener("input", () => {
        state.search = search.value;
        refreshRecordResults();
      });
    }

    const status = app.querySelector("[data-status-filter]");
    if (status) {
      status.addEventListener("change", () => {
        state.statusFilter = status.value || "all";
        refreshRecordResults();
      });
    }

    const month = app.querySelector("[data-month-filter]");
    if (month) {
      month.addEventListener("change", () => {
        state.monthFilter = month.value || currentMonth();
        refreshRecordResults();
      });
    }

    bindRecordActionButtons(app);
  }

  function refreshRecordResults() {
    const searched = filteredStatements();
    const monthRows = monthlyStatements();
    const monthTotal = monthRows.reduce((sum, statement) => sum + Number(statement.total || 0), 0);
    const customerCount = new Set(monthRows.map((statement) => statement.customer_name).filter(Boolean)).size;
    const summary = app.querySelector("[data-record-summary]");
    const results = app.querySelector("[data-record-results]");
    if (summary) summary.innerHTML = renderRecordSummary(customerCount, monthRows, monthTotal);
    if (results) {
      results.innerHTML = searched.length ? renderRecordRows(searched, false) : '<div class="empty">검색 결과가 없습니다.</div>';
      bindRecordActionButtons(results);
    }
  }

  function bindRecordActionButtons(root) {
    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleRecordAction(button.dataset.action, button));
    });
  }

  function bindDataEvents() {
    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "export-data") exportData();
      });
    });

    const input = app.querySelector("[data-import-data]");
    if (input) {
      input.addEventListener("change", importData);
    }
  }

  function exportData() {
    const backup = {
      app: "beebill-statement",
      version: 2,
      exported_at: new Date().toISOString(),
      data: store
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    triggerDownload(blob, `거래명세서_백업_${today()}.json`);
    showToast("백업 파일을 저장했습니다.");
  }

  function importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}"));
        const imported = normalizeStore(raw.data || raw, {
          customers: [],
          products: [],
          statements: [],
          businessProfile: { ...DEFAULT_BUSINESS_PROFILE }
        });
        store = mergeStores(store, imported);
        persist();
        showToast("백업 데이터를 가져왔습니다.");
        render();
      } catch (error) {
        console.error(error);
        showToast("백업 파일을 읽지 못했습니다.");
      }
    };
    reader.onerror = () => showToast("백업 파일을 읽지 못했습니다.");
    reader.readAsText(file, "utf-8");
  }

  function mergeStores(current, imported) {
    return {
      businessProfile: imported.businessProfile?.business_name ? imported.businessProfile : current.businessProfile,
      products: mergeById(current.products, imported.products),
      customers: mergeById(current.customers, imported.customers),
      statements: mergeById(current.statements, imported.statements)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    };
  }

  function mergeById(currentRows, importedRows) {
    const map = new Map();
    currentRows.forEach((row) => map.set(row.id || uid("row"), row));
    importedRows.forEach((row) => map.set(row.id || uid("row"), row));
    return [...map.values()];
  }

  async function handleRecordAction(action, button) {
    const row = button.closest("[data-statement-id]");
    const statement = store.statements.find((candidate) => candidate.id === row.dataset.statementId);
    if (!statement) return;

    if (action === "load-record") {
      state.statement = normalizeStatement({ ...statement, items: statement.items.map((item) => ({ ...item })) });
      state.editingStatementId = statement.id;
      setView("statement");
      return;
    }

    if (action === "copy-record") {
      state.statement = normalizeStatement({
        ...statement,
        id: uid("statement"),
        statement_no: nextStatementNo(today()),
        issue_date: today(),
        delivery_date: today(),
        status: "draft",
        sent_method: "",
        sent_at: "",
        pdf_url: "",
        jpg_url: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: statement.items.map((item) => ({ ...item, id: uid("item") }))
      });
      state.editingStatementId = null;
      setView("statement");
      return;
    }

    if (action === "record-pdf") {
      await downloadPdf(button, statement);
      return;
    }

    if (action === "record-jpg") {
      await downloadJpg(button, statement);
      return;
    }

    if (action === "record-sent") {
      const method = window.prompt("발송방법을 입력하세요. 예: 카카오톡, 문자, 이메일, 직접전달", statement.sent_method || "카카오톡");
      if (method === null) return;
      statement.status = "sent";
      statement.sent_method = method.trim() || "직접전달";
      statement.sent_at = new Date().toISOString();
      statement.updated_at = new Date().toISOString();
      persist();
      showToast("발송완료로 기록했습니다.");
      render();
      return;
    }

    if (action === "delete-record") {
      if (!window.confirm("이 거래명세서 기록을 삭제할까요?")) return;
      store.statements = store.statements.filter((candidate) => candidate.id !== statement.id);
      persist();
      showToast("기록을 삭제했습니다.");
      render();
    }
  }

  function bindManageEvents() {
    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleManageAction(button.dataset.action, button));
    });

    app.querySelectorAll("[data-money-field]").forEach((input) => {
      input.addEventListener("blur", () => {
        input.value = numberInput(input.value);
      });
    });

    const sealUpload = app.querySelector("[data-seal-upload]");
    if (sealUpload) {
      sealUpload.addEventListener("change", handleSealUpload);
    }
  }

  async function handleManageAction(action, button) {
    if (action === "save-customer") return saveCustomer();
    if (action === "save-product") return saveProduct();
    if (action === "save-business") return saveBusiness();
    if (action === "remove-seal") {
      store.businessProfile.seal_image_url = "";
      persist();
      showToast("도장 이미지를 삭제했습니다.");
      render();
      return;
    }
    if (action === "cancel-customer-edit") {
      state.editingCustomerId = null;
      render();
      return;
    }
    if (action === "cancel-product-edit") {
      state.editingProductId = null;
      render();
      return;
    }

    const customerRow = button.closest("[data-customer-id]");
    const productRow = button.closest("[data-product-id]");

    if (action === "edit-customer" && customerRow) {
      state.editingCustomerId = customerRow.dataset.customerId;
      render();
      return;
    }

    if (action === "delete-customer" && customerRow) {
      const customer = store.customers.find((candidate) => candidate.id === customerRow.dataset.customerId);
      if (!customer || !window.confirm(`${customer.name} 거래처를 삭제할까요?`)) return;
      store.customers = store.customers.filter((candidate) => candidate.id !== customer.id);
      persist();
      render();
      return;
    }

    if (action === "edit-product" && productRow) {
      state.editingProductId = productRow.dataset.productId;
      render();
      return;
    }

    if (action === "delete-product" && productRow) {
      const product = store.products.find((candidate) => candidate.id === productRow.dataset.productId);
      if (!product || !window.confirm(`${product.name} ${product.spec} 상품을 삭제할까요?`)) return;
      store.products = store.products.filter((candidate) => candidate.id !== product.id);
      persist();
      render();
    }
  }

  function readFormData(selector) {
    const form = app.querySelector(selector);
    const data = {};
    form.querySelectorAll("input, textarea, select").forEach((input) => {
      if (input.type === "file") return;
      data[input.name] = input.value.trim();
    });
    return data;
  }

  function saveCustomer() {
    const data = readFormData('[data-editor="customer"]');
    if (!data.name) {
      showToast("거래처명을 입력해 주세요.");
      return;
    }
    data.default_commission_rate = parseNumber(data.default_commission_rate);
    const now = new Date().toISOString();
    if (state.editingCustomerId) {
      const customer = store.customers.find((candidate) => candidate.id === state.editingCustomerId);
      Object.assign(customer, data, { updated_at: now });
    } else {
      store.customers.push(normalizeCustomer({ id: uid("customer"), ...data, created_at: now, updated_at: now }));
    }
    state.editingCustomerId = null;
    persist();
    showToast("거래처를 저장했습니다.");
    render();
  }

  function saveProduct() {
    const data = readFormData('[data-editor="product"]');
    if (!data.name) {
      showToast("품목명을 입력해 주세요.");
      return;
    }
    data.retail_price = parseNumber(data.retail_price);
    data.default_commission_rate = parseNumber(data.default_commission_rate);
    data.default_supply_price = parseNumber(data.default_supply_price);
    data.price_mode = data.price_mode === "manual" ? "manual" : "auto";
    const now = new Date().toISOString();
    const normalized = normalizeProduct({ ...data, updated_at: now });
    if (state.editingProductId) {
      const product = store.products.find((candidate) => candidate.id === state.editingProductId);
      Object.assign(product, normalized, { id: product.id, created_at: product.created_at, updated_at: now });
    } else {
      store.products.push({ ...normalized, id: uid("product"), created_at: now, updated_at: now });
    }
    state.editingProductId = null;
    persist();
    showToast("상품을 저장했습니다.");
    render();
  }

  function saveBusiness() {
    const data = readFormData('[data-editor="business"]');
    if (!data.business_name || !data.representative_name) {
      showToast("상호명과 대표자명을 입력해 주세요.");
      return;
    }
    store.businessProfile = normalizeBusinessProfile({
      ...store.businessProfile,
      ...data,
      updated_at: new Date().toISOString()
    });
    persist();
    showToast("사업자 정보를 저장했습니다.");
    render();
  }

  function handleSealUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      showToast("PNG 또는 JPG 이미지만 사용할 수 있습니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const currentForm = app.querySelector('[data-editor="business"]') ? readFormData('[data-editor="business"]') : {};
      store.businessProfile = normalizeBusinessProfile({
        ...store.businessProfile,
        ...currentForm,
        seal_image_url: String(reader.result)
      });
      persist();
      showToast("도장 이미지를 저장했습니다.");
      render();
    };
    reader.onerror = () => showToast("도장 이미지를 읽지 못했습니다.");
    reader.readAsDataURL(file);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => console.warn(error));
    });
  }

  window.addEventListener("resize", fitPreviewPaper);

  render();
})();
