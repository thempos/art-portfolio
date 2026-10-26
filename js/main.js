/* Small page behaviours that do not belong to a system: copying the email address, pointing the
   résumé links at the PDF of the language on screen, handing it over inside the Claude viewer. */
(() => {
  const button = document.getElementById("copy-mail");
  const label = document.getElementById("copy-label");
  const address = document.getElementById("mail");
  let timer;
  const selectAddress = () => {
    const range = document.createRange();
    range.selectNodeContents(address);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  // frames without clipboard permission still allow the older copy command
  const legacyCopy = (text) => {
    const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { /* not allowed here either */ }
    area.remove();
    return ok;
  };
  button.addEventListener("click", () => {
    const text = address.textContent.trim();
    const done = () => {
      label.textContent = TC.t("contact.copied");
      clearTimeout(timer);
      timer = setTimeout(() => { label.textContent = TC.t("contact.copy"); }, 2200);
    };
    const fallback = () => (legacyCopy(text) ? done() : selectAddress());
    try {
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) {
      fallback();
    }
  });

  // a single résumé link wherever one appears; it follows the language toggle
  const CV = { pt: "assets/curriculo-timothee-campos-pt.pdf", en: "assets/resume-timothee-campos-en.pdf" };
  const cvLinks = [...document.querySelectorAll("[data-cv]")];
  const pointCv = () => cvLinks.forEach((a) => a.setAttribute("href", CV[TC.lang()]));
  pointCv();
  document.addEventListener("tc:lang", pointCv);

  // the Claude viewer ignores plain download links, so there the PDFs go through its save prompt;
  // on GitHub Pages window.claude does not exist and the links download as usual
  if (window.claude && window.claude.use) {
    window.claude.use("downloads").then((downloads) => {
      if (!downloads) return;
      document.querySelectorAll("a[download]").forEach((a) => a.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const blob = await (await fetch(a.href)).blob();
          await downloads.save({ filename: a.href.split("/").pop(), data: blob });
        } catch (err) { /* declined, or saving is not offered in this view */ }
      }));
    }, () => {});
  }
})();
