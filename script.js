/* =========================
   Viylo — Logic + Animations + PayPal
   ========================= */

const SERVICES = [
  { id: "video_edit", name: "Video Editing", desc: "Polished edits for ads, social and corporate.", price: 150 },
  { id: "web_dev", name: "Web Development", desc: "Fast, responsive websites tailored to your goals.", price: 400 },
  { id: "logo", name: "Logo Design", desc: "Unique brand identity with scalable vectors.", price: 100 },
  { id: "smm", name: "Social Media Management", desc: "Content planning, posting & reporting each month.", price: 200 },
  { id: "seo", name: "SEO Setup", desc: "On-page SEO, sitemap, indexing & performance.", price: 180 },
  { id: "branding", name: "Brand Kit", desc: "Fonts, colors, social templates & guidelines.", price: 220 },
];

const JOD_TO_USD = 1.41; // static conversion used for PayPal (USD)
const cart = new Map();

const servicesGrid = document.getElementById("servicesGrid");
const cartList = document.getElementById("cartList");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const totalEl = document.getElementById("total");
const usdNote = document.getElementById("usdNote");
const orderForm = document.getElementById("orderForm");
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");

function renderServices() {
  servicesGrid.innerHTML = "";
  SERVICES.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "card will-reveal";
    card.style.transitionDelay = `${0.05 * i}s`;
    card.innerHTML = `
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="price">${s.price.toFixed(2)} JOD</div>
      <div class="qty">
        <button data-id="${s.id}" class="minus">−</button>
        <span id="qty-${s.id}">0</span>
        <button data-id="${s.id}" class="plus">+</button>
        <button data-id="${s.id}" class="btn add-btn">Add</button>
      </div>
    `;
    servicesGrid.appendChild(card);
  });
}

/* --- Qty & Cart --- */
servicesGrid.addEventListener("click", e => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.classList.contains("plus")) bumpQty(id, 1);
  else if (e.target.classList.contains("minus")) bumpQty(id, -1);
  else if (e.target.classList.contains("add-btn")) {
    const qty = parseInt(document.getElementById(`qty-${id}`).innerText, 10);
    if (qty <= 0) return alert("Select at least 1 unit!");
    addToCart(id, qty);
    document.getElementById(`qty-${id}`).innerText = "0";
  }
});

function bumpQty(id, delta) {
  const el = document.getElementById(`qty-${id}`);
  el.innerText = Math.max(0, parseInt(el.innerText, 10) + delta);
}

function addToCart(id, qty) {
  const service = SERVICES.find(s => s.id === id);
  const existing = cart.get(id);
  cart.set(id, { service, qty: existing ? existing.qty + qty : qty });
  renderCart();
}

function removeFromCart(id) {
  cart.delete(id);
  renderCart();
}

function computeTotals() {
  let subtotal = 0;
  cart.forEach(({ service, qty }) => subtotal += service.price * qty);
  const tax = 0;
  return { subtotal, tax, total: subtotal + tax };
}

function renderCart() {
  cartList.innerHTML = "";
  cart.forEach(({ service, qty }) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <div>
        <div class="title">${service.name}</div>
        <div class="muted">x${qty} • ${service.price.toFixed(2)} JOD each</div>
      </div>
      <div class="muted">${(service.price * qty).toFixed(2)} JOD</div>
      <button class="del" data-id="${service.id}">×</button>
    `;
    cartList.appendChild(li);
  });
  cartList.querySelectorAll(".del").forEach(btn =>
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id))
  );

  const { subtotal, tax, total } = computeTotals();
  subtotalEl.innerText = `${subtotal.toFixed(2)} JOD`;
  taxEl.innerText = `${tax.toFixed(2)} JOD`;
  totalEl.innerText = `${total.toFixed(2)} JOD`;

  // Update USD note & PayPal button
  const usd = total * JOD_TO_USD;
  usdNote.textContent = total
    ? `Estimated charge on PayPal: ~${usd.toFixed(2)} USD (converted from JOD)`
    : "";
  setupPayPal(total);
}

/* --- EmailJS (Order form) --- */
function buildOrderLines() {
  if (!cart.size) return "No services selected";
  return [...cart.values()]
    .map(c => `${c.service.name} x${c.qty} — ${(c.service.price * c.qty).toFixed(2)} JOD`)
    .join("\n");
}
function generateOrderId() {
  return `VY-${Math.floor(Math.random()*1_000_000).toString().padStart(6,"0")}`;
}

orderForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!cart.size) return alert("Add at least 1 service to the cart before ordering.");

  const { subtotal, tax, total } = computeTotals();
  const templateParams = {
    order_id: generateOrderId(),
    customer_name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    company: document.getElementById("company").value.trim() || "—",
    notes: document.getElementById("notes").value.trim() || "—",
    order_lines: buildOrderLines(),
    subtotal, tax, total,
    to_email: "hamatij66@gmail.com"
  };

  try {
    await emailjs.send("service_4qp0jds", "template_jtu765g", templateParams);
    orderForm.reset(); cart.clear(); renderCart();
    modal.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("Failed to send order. Check EmailJS keys or your connection.");
  }
});

closeModal.addEventListener("click", () => modal.classList.add("hidden"));
window.addEventListener("keydown", e => {
  if (e.key === "Escape") modal.classList.add("hidden");
});

/* --- Scroll reveal (uses .will-reveal / .is-visible) --- */
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

function initReveal() {
  document.querySelectorAll(".will-reveal").forEach(el => io.observe(el));
}

/* --- PayPal --- */
let paypalButtons; // keep reference so we can re-render on total change
function setupPayPal(totalJOD) {
  const container = document.getElementById("paypal-button-container");
  const fallback = document.getElementById("paypalFallback");

  // If no total, clear buttons
  if (!totalJOD) {
    container.innerHTML = "";
    if (paypalButtons && paypalButtons.close) paypalButtons.close();
    return;
  }

  // If SDK missing
  if (typeof window.paypal === "undefined") {
    fallback.style.display = "block";
    return;
  } else {
    fallback.style.display = "none";
  }

  const totalUSD = (totalJOD * JOD_TO_USD).toFixed(2);
  container.innerHTML = "";

  if (paypalButtons && paypalButtons.close) paypalButtons.close();
  paypalButtons = paypal.Buttons({
    createOrder: (data, actions) => actions.order.create({
      purchase_units: [{
        amount: { value: totalUSD, currency_code: "USD" },
        description: "Viylo services"
      }]
    }),
    onApprove: (data, actions) =>
      actions.order.capture().then(details => {
        alert(`Payment completed by ${details.payer.name.given_name}. Thank you!`);
      }),
    onError: (err) => {
      console.error(err);
      alert("PayPal error. Please try again or contact us.");
    }
  });

  paypalButtons.render("#paypal-button-container");
}

/* --- Init --- */
renderServices();
renderCart();
initReveal();
setupPayPal(0);