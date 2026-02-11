// Minimal DOM helpers to avoid innerHTML for dynamic content.
// Exposed as window.ssdcDom for non-module scripts.
(function () {
  function clear(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, className, attrs) {
    const node = document.createElement(String(tag || "div"));
    if (className) {
      node.className = String(className);
    }
    if (attrs && typeof attrs === "object") {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];
        if (value == null) return;
        if (key === "text") {
          node.textContent = String(value);
          return;
        }
        if (key === "html") {
          throw new Error("ssdcDom.el does not support 'html' for security. Use DOM nodes + textContent.");
        }
        if (key === "dataset" && value && typeof value === "object") {
          Object.keys(value).forEach((dkey) => {
            const dval = value[dkey];
            if (dval == null) return;
            try {
              node.dataset[dkey] = String(dval);
            } catch (e) {
              // ignore
            }
          });
          return;
        }
        try {
          node.setAttribute(String(key), String(value));
        } catch (e) {
          // ignore
        }
      });
    }
    return node;
  }

  function setText(node, value) {
    if (!node) return;
    node.textContent = value == null ? "" : String(value);
  }

  function append(parent) {
    if (!parent) return;
    for (let i = 1; i < arguments.length; i++) {
      const child = arguments[i];
      if (!child) continue;
      parent.appendChild(child);
    }
  }

  function on(node, event, handler, options) {
    if (!node || !event || typeof handler !== "function") return;
    node.addEventListener(String(event), handler, options);
  }

  function setVisible(node, visible) {
    if (!node) return;
    node.hidden = !visible;
  }

  window.ssdcDom = {
    clear,
    el,
    setText,
    append,
    on,
    setVisible
  };
})();
