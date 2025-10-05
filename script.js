// script.js
"use strict";

const bar = document.getElementById("bar");
const nav = document.getElementById("navbar");

if (bar) {
  bar.addEventListener("click", () => {
    nav.classList.add("active");
  });
}
const close = document.getElementById("close");
if (close) {
  close.addEventListener("click", () => {
    nav.classList.remove("active");
  });
}

// Show cart message
function showCartMessage(text, isError = false) {
  const msg = document.getElementById("cart-message");
  if (!msg) return;
  msg.textContent = text;
  msg.classList.add("show");
  msg.style.backgroundColor = isError ? "#e74c3c" : "#2ecc71";
  msg.style.color = "#fff";
  setTimeout(() => {
    msg.classList.remove("show");
  }, 2500);
}

let isCouponApplied = false;

function subtotal(cart) {
  return cart.reduce((sum, item) => sum + item.qty * item.price, 0);
}

document.addEventListener("DOMContentLoaded", function () {
  const addToCartButtons = document.querySelectorAll(".add-to-cart");
  const cartContainer = document.getElementById("cart-items");
  const couponInput = document.getElementById("coupon-code");
  const applyBtn = document.getElementById("apply-coupon");
  const couponMsg = document.getElementById("coupon-msg");

  let cart = [];
  let user = JSON.parse(localStorage.getItem("user"));

  // Load cart from server if logged in
  async function loadCart() {
    if (user && user.username) {
      const res = await fetch(
        `/api/cart?username=${encodeURIComponent(user.username)}`
      );
      if (res.ok) {
        cart = await res.json();
      } else {
        cart = [];
      }
    } else {
      cart = [];
    }
  }
  // Save cart to server if logged in
  async function saveCart() {
    if (user && user.username) {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, cart }),
      });
    }
  }

  // Initial cart load
  loadCart().then(renderCart);

  // Handle Add to Cart
  addToCartButtons.forEach((button) => {
    button.addEventListener("click", async function (e) {
      e.preventDefault();
      if (!user || !user.username) {
        showCartMessage("Please login/signup to add items to cart!", true);
        return;
      }
      const sizeSelect = document.getElementById("size-select");
      if (sizeSelect && sizeSelect.value === "") {
        showCartMessage("Please select a size before adding to cart!", true);
        return;
      }
      const name = this.getAttribute("data-name");
      const price = parseFloat(this.getAttribute("data-price"));
      const img = this.getAttribute("data-img");

      const existingItem = cart.find((item) => item.name === name);
      if (existingItem) {
        existingItem.qty += 1;
      } else {
        cart.push({ name, price, img, qty: 1 });
      }

      await saveCart();
      showCartMessage(`${name} added to cart!`);
      renderCart();
    });
  });

  // Render Cart
  function renderCart() {
    if (!cartContainer) return;

    if (cart.length === 0) {
      cartContainer.innerHTML = "<p>Your cart is empty.</p>";
      const actions = document.getElementById("cart-actions");
      if (actions) actions.style.display = "none";
      return;
    }

    let totalBeforeDiscount = subtotal(cart);
    let discount = 0;
    if (isCouponApplied && totalBeforeDiscount >= 50) {
      discount = 50;
    }

    const shipping = totalBeforeDiscount - discount > 0 ? 25 : 0;
    const grandTotal = totalBeforeDiscount - discount + shipping;

    let html = `
      <table>
        <tr>
          <th>Image</th>
          <th>Product</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Action</th>
        </tr>
    `;

    cart.forEach((item, index) => {
      const total = item.qty * item.price;
      html += `
        <tr>
          <td><img src="${item.img}" width="70" /></td>
          <td>${item.name}</td>
          <td>$${item.price}</td>
          <td>${item.qty}</td>
          <td>$${total.toFixed(2)}</td>
          <td><button class="delete-btn" data-index="${index}">Remove</button></td>
        </tr>
      `;
    });

    html += `
      <tr><td colspan="4"><strong>Subtotal</strong></td><td colspan="2">$${totalBeforeDiscount.toFixed(
        2
      )}</td></tr>
      <tr><td colspan="4"><strong>Coupon Discount</strong></td><td colspan="2">- $${discount.toFixed(
        2
      )}</td></tr>
      <tr><td colspan="4"><strong>Shipping</strong></td><td colspan="2">+ $${shipping.toFixed(
        2
      )}</td></tr>
      <tr><td colspan="4"><strong>Grand Total</strong></td><td colspan="2"><strong>$${grandTotal.toFixed(
        2
      )}</strong></td></tr>
    </table>`;

    cartContainer.innerHTML = html;

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const index = parseInt(this.getAttribute("data-index"));
        if (cart[index].qty > 1) {
          cart[index].qty -= 1;
        } else {
          cart.splice(index, 1);
        }
        await saveCart();
        renderCart();
      });
    });
  }

  // Apply Coupon
  applyBtn?.addEventListener("click", function () {
    const code = couponInput.value.trim().toUpperCase();

    if (code === "SHOPSP" && subtotal(cart) >= 50) {
      isCouponApplied = true;
      couponMsg.textContent = "Coupon applied successfully!";
      couponMsg.style.color = "green";
    } else {
      isCouponApplied = false;
      couponMsg.textContent = "Invalid or ineligible coupon!";
      couponMsg.style.color = "red";
    }

    renderCart();
  });

  renderCart();

  // Stripe payment integration
  const buyBtn = document.getElementById("buy-now");
  const paymentModal = document.getElementById("payment-modal");
  let stripe, elements, card;

  if (buyBtn) {
    buyBtn.addEventListener("click", async function () {
      if (!user || !user.username) {
        alert("Please login/signup to buy!");
        return;
      }
      if (!cart || cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }
      paymentModal.style.display = "flex";
      if (!stripe) {
        stripe = Stripe("pk_test_51SEoXc1PonzzBBYV0OdBPibfmgpl0ToCCLKf6FWf07YDRVaWfSAMt5fpDRbsdFlpEjxHJV7svPVEjd3kQvALGBzH00etKusqRC"); 
        elements = stripe.elements();
        card = elements.create("card");
        card.mount("#card-element");
      }
    });
  }

  const paymentForm = document.getElementById("payment-form");
  if (paymentForm) {
    paymentForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      document.getElementById("submit-payment").disabled = true;
      document.getElementById("payment-message").textContent = "Processing...";
      // Calculate total
      const total =
        subtotal(cart) +
        (isCouponApplied ? -50 : 0) +
        (subtotal(cart) > 0 ? 25 : 0);
      // Create payment intent on server
      const res = await fetch("/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total }),
      });
      const data = await res.json();
      if (!data.clientSecret) {
        document.getElementById("payment-message").textContent =
          "Payment error!";
        document.getElementById("submit-payment").disabled = false;
        return;
      }
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: card,
        },
      });
      if (result.error) {
        document.getElementById("payment-message").textContent =
          result.error.message;
        document.getElementById("submit-payment").disabled = false;
      } else if (result.paymentIntent.status === "succeeded") {
        document.getElementById("payment-message").textContent =
          "Payment successful!";
        setTimeout(() => {
          paymentModal.style.display = "none";
          cart = [];
          saveCart();
          renderCart();
        }, 2000);
      }
    });
  }
});

// For animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      } else {
        entry.target.classList.remove("visible");
      }
    });
  },
  {
    threshold: 0.3,
  }
);

document
  .querySelectorAll(".animate-towards-right")
  .forEach((el) => observer.observe(el));
document
  .querySelectorAll(".animate-towards-left")
  .forEach((el) => observer.observe(el));
document
  .querySelectorAll(".animate-towards-left")
  .forEach((el) => observer.observe(el));
document
  .querySelectorAll(".animate-fade")
  .forEach((el) => observer.observe(el));