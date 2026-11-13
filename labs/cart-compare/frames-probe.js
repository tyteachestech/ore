// Frame timing for one play: every animation frame's gap for 8 s from the moment the ending starts (the page
// fires "cart-start"), posted to the comparison page that holds this one.
addEventListener("cart-start", () => {
  const gaps = [];
  let last = performance.now();
  const t0 = last;
  const tick = (t) => {
    gaps.push(t - last);
    last = t;
    if (t - t0 < 8000) requestAnimationFrame(tick);
    else parent.postMessage({ frames: gaps }, "*");
  };
  requestAnimationFrame(tick);
}, { once: true });
