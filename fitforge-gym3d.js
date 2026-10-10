/* FitForge gym 3D add-on (red/black theme).
 * Add ONE line before </body> in index.html:
 *   <script src="fitforge-gym3d.js" defer></script>
 * Changes nothing in your existing HTML/CSS/JS. Remove the line to remove it.
 * Adds: spinning dumbbell on the portrait card, a bigger one in the
 * "Your next rep" strip, and two spinning plates drifting at the page edges.
 */
(function () {
  "use strict";
  if (window.__ffGym3d) return;
  window.__ffGym3d = true;

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* 3D cylinder lying along the X axis */
  function cylinder(parent, o) {
    var n = o.sides, apothem = o.r * Math.cos(Math.PI / n);
    var w = 2 * o.r * Math.sin(Math.PI / n) + 0.6;
    for (var i = 0; i < n; i++) {
      var ang = (360 / n) * i;
      var f = document.createElement("i");
      f.className = "ffg-face " + o.face;
      f.style.width = o.len + "px";
      f.style.height = w + "px";
      f.style.marginLeft = o.x - o.len / 2 + "px";
      f.style.marginTop = -w / 2 + "px";
      f.style.transform = "rotateX(" + ang + "deg) translateZ(" + apothem + "px)";
      f.style.filter = "brightness(" + (0.4 + 0.8 * Math.abs(Math.cos((ang * Math.PI) / 180 - 0.6))).toFixed(2) + ")";
      parent.appendChild(f);
    }
    [-1, 1].forEach(function (s) {
      var cap = document.createElement("i");
      cap.className = "ffg-cap " + o.cap;
      cap.style.width = cap.style.height = o.r * 2 + "px";
      cap.style.marginLeft = cap.style.marginTop = -o.r + "px";
      cap.style.transform = "translateX(" + (o.x + (s * o.len) / 2) + "px) rotateY(90deg)";
      parent.appendChild(cap);
    });
  }

  function shell(cls, scale, spinClass) {
    var obj = document.createElement("div");
    obj.className = "ffg-obj " + cls;
    var sc = document.createElement("div");
    sc.className = "ffg-sc";
    sc.style.transform = "scale(" + scale + ")";
    var spin = document.createElement("div");
    spin.className = spinClass;
    sc.appendChild(spin);
    obj.appendChild(sc);
    return { obj: obj, spin: spin };
  }

  function dumbbell(cls, scale) {
    var p = shell(cls, scale, "ffg-spin");
    cylinder(p.spin, { x: 0, len: 190, r: 8, sides: 14, face: "ffg-bar", cap: "ffg-barcap" });
    [-1, 1].forEach(function (s) {
      cylinder(p.spin, { x: s * 62, len: 20, r: 68, sides: 32, face: "ffg-plate", cap: "ffg-platecap" });
      cylinder(p.spin, { x: s * 82, len: 14, r: 50, sides: 28, face: "ffg-plate", cap: "ffg-platecap" });
      cylinder(p.spin, { x: s * 40, len: 10, r: 13, sides: 12, face: "ffg-collar", cap: "ffg-collarcap" });
    });
    return p.obj;
  }

  function plate(cls, scale) {
    var p = shell(cls, scale, "ffg-spin ffg-spin-plate");
    cylinder(p.spin, { x: 0, len: 22, r: 68, sides: 32, face: "ffg-plate", cap: "ffg-platecap" });
    cylinder(p.spin, { x: 0, len: 26, r: 14, sides: 12, face: "ffg-collar", cap: "ffg-collarcap" });
    return p.obj;
  }

  ready(function () {
    var css = [
      ".ffg-obj{position:absolute;width:0;height:0;pointer-events:none;perspective:900px;animation:ffgFloat 6s ease-in-out infinite}",
      ".ffg-sc{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}",
      ".ffg-spin{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;animation:ffgSpin 16s linear infinite}",
      ".ffg-spin-plate{animation-name:ffgSpinPlate;animation-duration:12s}",
      ".ffg-face,.ffg-cap{position:absolute;left:50%;top:50%;display:block}",
      ".ffg-cap{border-radius:50%}",
      ".ffg-bar{background:repeating-linear-gradient(90deg,#8a8a90 0 3px,#4a4a50 3px 6px)}",
      ".ffg-barcap{background:#55555b}",
      ".ffg-plate{background:linear-gradient(90deg,#141416,#2a2a2f 50%,#141416)}",
      ".ffg-platecap{background:radial-gradient(circle,#080809 0 14%,var(--red,#ff3030) 15% 18%,#1b1b1f 19% 60%,var(--red,#ff3030) 61% 64%,#111113 65% 100%);box-shadow:inset 0 0 0 2px var(--red,#ff3030)}",
      ".ffg-collar,.ffg-collarcap{background:var(--red-dark,#d91919)}",
      /* fixed edge plates (behind page content, like the particles) */
      ".ffg-edge{position:fixed;z-index:1;opacity:.4;filter:drop-shadow(0 0 18px rgba(255,48,48,.25))}",
      ".ffg-e1{left:-30px;top:26%}",
      ".ffg-e2{right:-20px;top:66%;animation-duration:8s}",
      /* mini dumbbell on the portrait card */
      ".ffg-card{z-index:4;left:50%;top:46px}",
      /* bigger dumbbell in the contact strip */
      ".ffg-strip{left:50%;top:50%;z-index:0}",
      "@keyframes ffgSpin{from{transform:rotateZ(-14deg) rotateX(-16deg) rotateY(0)}to{transform:rotateZ(-14deg) rotateX(-16deg) rotateY(360deg)}}",
      "@keyframes ffgSpinPlate{from{transform:rotateX(-14deg) rotateZ(-8deg) rotateX(0)}to{transform:rotateX(-14deg) rotateZ(-8deg) rotateX(360deg)}}",
      "@keyframes ffgFloat{0%,100%{margin-top:-8px}50%{margin-top:10px}}",
      "@media (max-width:980px){.ffg-edge,.ffg-strip{display:none}}",
      "@media (prefers-reduced-motion:reduce){.ffg-obj,.ffg-spin{animation:none!important}}"
    ].join("\n");
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    function mark(el) { el.setAttribute("aria-hidden", "true"); return el; }

    // 1) portrait card (top centre)
    var card = document.querySelector(".portrait-card");
    if (card) card.appendChild(mark(dumbbell("ffg-card", 0.5)));

    // 2) "your next rep" strip (centre)
    var strip = document.querySelector(".contact-strip");
    if (strip) strip.appendChild(mark(dumbbell("ffg-strip", 0.85)));

    // 3) edge plates drifting in the background
    document.body.appendChild(mark(plate("ffg-edge ffg-e1", 1.5)));
    document.body.appendChild(mark(plate("ffg-edge ffg-e2", 1.1)));
  });
})();
