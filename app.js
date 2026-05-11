(function () {
  const STORAGE_KEY = "beebill.statement.v1";
  const SUPPLIER_DEFAULT = {
    company: "꿀벌빵",
    representative: "김도윤",
    phone: "010-0000-0000",
    businessNo: "",
    address: ""
  };

  const app = document.getElementById("app");

  const state = {
    view: "home",
    manageTab: "customers",
    editingStatementId: null,
    editingCustomerId: null,
    editingProductId: null,
    search: "",
    monthFilter: currentMonth(),
    statement: null
  };

  let store = loadStore();
  state.statement = createBlankStatement();

  function loadStore() {
    const fallback = {
      customers: [],
      products: [
        {
          id: uid("product"),
          name: "꿀벌빵",
          spec: "12개입",
          default_price: 29000,
          unit: "박스",
          memo: "",
          created_at: new Date().toISOString()
        },
        {
          id: uid("product"),
          name: "꿀벌빵",
          spec: "5개입",
          default_price: 12000,
          unit: "박스",
          memo: "",
          created_at: new Date().toISOString()
        }
      ],
      statements: [],
      supplier: SUPPLIER_DEFAULT
    };

    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed) return fallback;
      return {
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        products: Array.isArray(parsed.products) && parsed.products.length ? parsed.products : fallback.products,
        statements: Array.isArray(parsed.statements) ? parsed.statements : [],
        supplier: { ...SUPPLIER_DEFAULT, ...(parsed.supplier || {}) }
      };
    } catch (error) {
      console.warn(error);
      return fallback;
    }
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

  function createBlankItem() {
    const product = store.products[0];
    return {
      id: uid("item"),
      product_name: product ? product.name : "",
      spec: product ? product.spec : "",
      quantity: 1,
      unit: product ? product.unit : "박스",
      unit_price: product ? Number(product.default_price) : 0
    };
  }

  function createBlankStatement() {
    const issueDate = today();
    return {
      id: uid("statement"),
      statement_no: nextStatementNo(issueDate),
      customer_id: "",
      customer_name: "",
      customer_manager: "",
      customer_phone: "",
      customer_address: "",
      issue_date: issueDate,
      delivery_date: issueDate,
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

  function money(value) {
    return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
  }

  function productOptionValue(product) {
    return `${product.name} | ${product.spec || "규격 없음"} | ${money(product.default_price)}`;
  }

  function plainMoney(value) {
    return String(Math.round(Number(value) || 0));
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

  function calculate(statement) {
    const baseAmount = statement.items.reduce((sum, item) => {
      return sum + parseNumber(item.quantity) * parseNumber(item.unit_price);
    }, 0);

    if (statement.vat_mode === "exclusive") {
      const vat = Math.round(baseAmount * 0.1);
      return { subtotal: baseAmount, vat, total: baseAmount + vat };
    }

    if (statement.vat_mode === "inclusive") {
      const subtotal = Math.round(baseAmount / 1.1);
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

  function render() {
    app.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand-lockup">
            <div class="brand-mark" aria-hidden="true">BB</div>
            <div class="brand-text">
              <h1 class="brand-title">꿀벌빵 거래명세서 생성기</h1>
              <p class="brand-subtitle">거래명세서 · 납품기록 · 월별 정산</p>
            </div>
          </div>
          <nav class="nav" aria-label="주요 화면">
            ${navButton("home", "홈")}
            ${navButton("statement", "새 거래명세서")}
            ${navButton("records", "기록 보기")}
            ${navButton("manage", "거래처/상품")}
          </nav>
        </header>
        ${renderView()}
      </div>
    `;

    bindCommonEvents();
    if (state.view === "statement") bindStatementEvents();
    if (state.view === "records") bindRecordEvents();
    if (state.view === "manage") bindManageEvents();
  }

  function navButton(view, label) {
    const current = state.view === view ? 'aria-current="page"' : "";
    return `<button type="button" data-view="${view}" ${current}>${label}</button>`;
  }

  function renderView() {
    if (state.view === "statement") return renderStatementView();
    if (state.view === "records") return renderRecordsView();
    if (state.view === "manage") return renderManageView();
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
        <button class="home-action" type="button" data-view="statement" data-testid="new-statement">
          <strong>+ 새 거래명세서 작성</strong>
          <span>A4 미리보기와 PDF/JPG 저장</span>
        </button>
        <button class="home-action" type="button" data-view="records">
          <strong>기록 보기</strong>
          <span>검색, 발송상태, 월별 합계</span>
        </button>
        <button class="home-action" type="button" data-view="manage">
          <strong>거래처 / 상품 관리</strong>
          <span>자주 쓰는 거래처와 단가 저장</span>
        </button>
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

  function renderStatementView() {
    const statement = state.statement;
    const totals = calculate(statement);
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">새 거래명세서 작성</h2>
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
            ${renderStatementPaper(statement)}
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
        <h3 class="form-section-title full">품목</h3>
        <div class="item-list full" data-item-list>
          ${statement.items.map(renderItemRow).join("")}
        </div>
        <button class="ghost full" type="button" data-action="add-item">+ 품목 추가</button>
        <label class="full">
          비고
          <textarea name="memo" data-statement-field="memo">${escapeHtml(statement.memo)}</textarea>
        </label>
      </div>
    `;
  }

  function renderItemRow(item) {
    const amount = parseNumber(item.quantity) * parseNumber(item.unit_price);
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
          수량
          <input inputmode="decimal" value="${escapeHtml(item.quantity)}" data-item-field="quantity" data-testid="item-quantity" />
        </label>
        <label>
          단위
          <input value="${escapeHtml(item.unit)}" data-item-field="unit" />
        </label>
        <label>
          단가
          <input inputmode="numeric" value="${escapeHtml(item.unit_price)}" data-item-field="unit_price" data-testid="item-price" />
        </label>
        <button type="button" class="icon-button danger" data-action="remove-item" aria-label="품목 삭제">×</button>
        <div class="wide total-box" aria-live="polite"><span>금액</span><b data-item-amount="${item.id}">${money(amount)}</b></div>
      </div>
    `;
  }

  function option(value, label, selected) {
    return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
  }

  function renderStatementPaper(statement) {
    const totals = calculate(statement);
    const rows = statement.items.length ? statement.items : [createBlankItem()];
    const fillerRows = Math.max(0, 8 - rows.length);
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
              <dt>상호</dt><dd>${escapeHtml(store.supplier.company)}</dd>
              <dt>대표</dt><dd>${escapeHtml(store.supplier.representative)}</dd>
              <dt>연락처</dt><dd>${escapeHtml(store.supplier.phone)}</dd>
              <dt>사업자번호</dt><dd>${escapeHtml(store.supplier.businessNo)}</dd>
              <dt>주소</dt><dd>${escapeHtml(store.supplier.address)}</dd>
            </dl>
          </section>
        </div>
        <table class="paper-table">
          <colgroup>
            <col style="width: 27%" />
            <col style="width: 16%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 17%" />
            <col style="width: 20%" />
          </colgroup>
          <thead>
            <tr>
              <th>품목</th>
              <th>규격</th>
              <th>수량</th>
              <th>단위</th>
              <th>단가</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderPaperItemRow).join("")}
            ${Array.from({ length: fillerRows }).map(() => `
              <tr>
                <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="paper-totals">
          <div class="memo-box"><b>비고</b><br />${escapeHtml(statement.memo)}</div>
          <div class="paper-total-lines">
            <div><span>공급가액</span><span>${money(totals.subtotal)}</span></div>
            <div><span>부가세</span><span>${money(totals.vat)}</span></div>
            <div><span>합계금액</span><span>${money(totals.total)}</span></div>
          </div>
        </div>
        <p class="paper-footer">위와 같이 거래명세서를 발행합니다.<br /><br />공급자: ${escapeHtml(store.supplier.company)} &nbsp; (인)</p>
        <p class="paper-notice">본 거래명세서는 납품 및 거래내역 확인용이며, 세금계산서·현금영수증 등 세무 증빙은 별도 발급이 필요할 수 있습니다.</p>
      </article>
    `;
  }

  function renderPaperItemRow(item) {
    const amount = parseNumber(item.quantity) * parseNumber(item.unit_price);
    return `
      <tr>
        <td>${escapeHtml(item.product_name)}</td>
        <td class="center">${escapeHtml(item.spec)}</td>
        <td class="right">${escapeHtml(item.quantity)}</td>
        <td class="center">${escapeHtml(item.unit)}</td>
        <td class="right">${money(item.unit_price)}</td>
        <td class="right">${money(amount)}</td>
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
        if (!term) return true;
        const haystack = [
          statement.customer_name,
          statement.issue_date,
          statement.delivery_date,
          statement.statement_no,
          statement.total,
          statusLabel(statement.status),
          statement.sent_method
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
    const first = items[0];
    const extra = items.length > 1 ? ` 외 ${items.length - 1}건` : "";
    return `${first.product_name || "품목"}${extra}`;
  }

  function renderManageView() {
    const isCustomers = state.manageTab === "customers";
    return `
      <div class="workspace">
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">거래처 / 상품 관리</h2>
            <div class="segmented" role="group" aria-label="관리 탭">
              <button type="button" data-manage-tab="customers" aria-pressed="${isCustomers}">거래처</button>
              <button type="button" data-manage-tab="products" aria-pressed="${!isCustomers}">상품</button>
            </div>
          </div>
          <div class="panel-body">
            ${isCustomers ? renderCustomerEditor() : renderProductEditor()}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2 class="panel-title">${isCustomers ? "거래처 목록" : "상품 목록"}</h2>
            <span class="status-pill">${isCustomers ? store.customers.length : store.products.length}건</span>
          </div>
          <div class="panel-body">
            ${isCustomers ? renderCustomerList() : renderProductList()}
          </div>
        </section>
      </div>
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
          기본 단가
          <input inputmode="numeric" name="default_price" value="${escapeHtml(editing.default_price)}" />
        </label>
        <label>
          단위
          <input name="unit" value="${escapeHtml(editing.unit || "박스")}" />
        </label>
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
                <span>${money(product.default_price)}</span>
                <span>${escapeHtml(product.unit || "단위 없음")}</span>
                <span>${escapeHtml(product.memo || "")}</span>
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
        state.statement[input.dataset.statementField] = input.value;
        if (input.dataset.statementField === "customer_name") fillCustomerIfMatched(input.value);
        if (input.dataset.statementField === "issue_date" && !state.editingStatementId) {
          state.statement.statement_no = nextStatementNo(input.value);
          const noInput = app.querySelector('[data-statement-field="statement_no"]');
          if (noInput) noInput.value = state.statement.statement_no;
        }
        refreshStatementOutput();
      });
      input.addEventListener("change", () => {
        state.statement[input.dataset.statementField] = input.value;
        refreshStatementOutput();
      });
    });

    app.querySelectorAll("[data-item-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest("[data-item-id]");
        const item = state.statement.items.find((candidate) => candidate.id === row.dataset.itemId);
        if (!item) return;
        item[input.dataset.itemField] = input.value;
        if (input.dataset.itemField === "product_name") fillProductIfMatched(item, input.value, row);
        refreshStatementOutput();
      });
    });

    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleStatementAction(button.dataset.action, button));
    });
  }

  function fillCustomerIfMatched(value) {
    const customer = store.customers.find((candidate) => candidate.name === value);
    if (!customer) return;
    state.statement.customer_id = customer.id;
    state.statement.customer_manager = customer.manager || "";
    state.statement.customer_phone = customer.phone || "";
    state.statement.customer_address = customer.address || "";
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
    item.unit_price = Number(product.default_price || 0);
    row.querySelector('[data-item-field="product_name"]').value = item.product_name;
    row.querySelector('[data-item-field="spec"]').value = item.spec;
    row.querySelector('[data-item-field="unit"]').value = item.unit;
    row.querySelector('[data-item-field="unit_price"]').value = item.unit_price;
  }

  function refreshStatementOutput() {
    const totals = calculate(state.statement);
    ["subtotal", "vat", "total"].forEach((field) => {
      const node = app.querySelector(`[data-total="${field}"]`);
      if (node) node.textContent = money(totals[field]);
    });
    state.statement.items.forEach((item) => {
      const node = app.querySelector(`[data-item-amount="${item.id}"]`);
      if (node) node.textContent = money(parseNumber(item.quantity) * parseNumber(item.unit_price));
    });
    const preview = app.querySelector(".preview-shell");
    if (preview) preview.innerHTML = renderStatementPaper(state.statement);
  }

  async function handleStatementAction(action, button) {
    if (action === "reset-statement") {
      state.editingStatementId = null;
      state.statement = createBlankStatement();
      render();
      return;
    }

    if (action === "add-item") {
      state.statement.items.push(createBlankItem());
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
      items: statement.items.map((item) => ({ ...item }))
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

  async function getStatementCanvas() {
    if (!window.html2canvas) throw new Error("html2canvas 라이브러리를 불러오지 못했습니다.");
    const paper = document.getElementById("statement-paper");
    if (!paper) throw new Error("미리보기 영역을 찾지 못했습니다.");
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return window.html2canvas(paper, {
      backgroundColor: "#ffffff",
      scale: 3,
      useCORS: true,
      logging: false,
      windowWidth: 1000
    });
  }

  async function downloadJpg(button) {
    const saved = saveCurrentStatement("generated");
    if (!saved) return;
    try {
      button.disabled = true;
      button.textContent = "생성 중";
      const canvas = await getStatementCanvas();
      const fileName = buildFileName(state.statement, "jpg");
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      triggerDownload(blob, fileName);
      saveCurrentStatement("generated", { jpg_url: fileName });
      showToast("JPG 파일을 저장했습니다.");
      render();
    } catch (error) {
      console.error(error);
      showToast(error.message || "JPG 생성에 실패했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = "JPG 저장";
    }
  }

  async function downloadPdf(button) {
    const saved = saveCurrentStatement("generated");
    if (!saved) return;
    try {
      button.disabled = true;
      button.textContent = "생성 중";
      const canvas = await getStatementCanvas();
      const image = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
      pdf.addImage(image, "JPEG", 0, 0, 210, 297);
      const fileName = buildFileName(state.statement, "pdf");
      pdf.save(fileName);
      saveCurrentStatement("generated", { pdf_url: fileName });
      showToast("PDF 파일을 저장했습니다.");
      render();
    } catch (error) {
      console.error(error);
      showToast(error.message || "PDF 생성에 실패했습니다.");
    } finally {
      button.disabled = false;
      button.textContent = "PDF 저장";
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

  function handleRecordAction(action, button) {
    const row = button.closest("[data-statement-id]");
    const statement = store.statements.find((candidate) => candidate.id === row.dataset.statementId);
    if (!statement) return;

    if (action === "load-record") {
      state.statement = { ...statement, items: statement.items.map((item) => ({ ...item })) };
      state.editingStatementId = statement.id;
      setView("statement");
      return;
    }

    if (action === "copy-record") {
      state.statement = {
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
      };
      state.editingStatementId = null;
      setView("statement");
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
    app.querySelectorAll("[data-manage-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.manageTab = button.dataset.manageTab;
        state.editingCustomerId = null;
        state.editingProductId = null;
        render();
      });
    });

    app.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => handleManageAction(button.dataset.action, button));
    });
  }

  function handleManageAction(action, button) {
    if (action === "save-customer") return saveCustomer();
    if (action === "save-product") return saveProduct();
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
    const now = new Date().toISOString();
    if (state.editingCustomerId) {
      const customer = store.customers.find((candidate) => candidate.id === state.editingCustomerId);
      Object.assign(customer, data, { updated_at: now });
    } else {
      store.customers.push({ id: uid("customer"), ...data, created_at: now });
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
    data.default_price = parseNumber(data.default_price);
    const now = new Date().toISOString();
    if (state.editingProductId) {
      const product = store.products.find((candidate) => candidate.id === state.editingProductId);
      Object.assign(product, data, { updated_at: now });
    } else {
      store.products.push({ id: uid("product"), ...data, created_at: now });
    }
    state.editingProductId = null;
    persist();
    showToast("상품을 저장했습니다.");
    render();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => console.warn(error));
    });
  }

  render();
})();
