(() => {
  "use strict";

  // Budget: minimalist redesign.
  // Rebrand, header, bottom navigation, More screen and small touches.
  // Loaded last so it can adjust everything the other files built.

  // ---- Logo: exact geometry measured from the chosen reference ----
  function logoSvg(size) {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");

    s.setAttribute("viewBox", "0 0 100 100");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("aria-hidden", "true");

    const rect = (x, y, w, h, rx, fill) => {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x);
      r.setAttribute("y", y);
      r.setAttribute("width", w);
      r.setAttribute("height", h);
      r.setAttribute("rx", rx);
      r.setAttribute("fill", fill);
      s.appendChild(r);
    };

    rect(0, 0, 100, 100, 31, "#212121");

    [
      [17.48, 27.97, 17.22, 53.36],
      [40.90, 17.81, 16.62, 63.52],
      [63.98, 37.86, 16.62, 43.14]
    ].forEach(b =>
      rect(b[0], b[1], b[2], b[3], b[2] / 2, "#fff")
    );

    return s;
  }

  // ---- Icons added for the new navigation ----
  ICONS.plus2 =
    '<line x1="12" y1="5" x2="12" y2="19"/>' +
    '<line x1="5" y1="12" x2="19" y2="12"/>';

  ICONS.more =
    '<circle cx="5" cy="12" r="1"/>' +
    '<circle cx="12" cy="12" r="1"/>' +
    '<circle cx="19" cy="12" r="1"/>';

  ICONS.star =
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';

  ICONS.trend =
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>' +
    '<polyline points="16 7 22 7 22 13"/>';

  // ---- Brand text: SalaryPlan becomes Budget on screen ----
  const BRAND_MAP = [
    [
      /Monthly budgeting for salary earners/g,
      "Simple budgeting for people and businesses"
    ],
    [
      /A simple, private monthly budgeting app for salary earners\./g,
      "A simple, private budgeting app for individuals, households, freelancers and businesses."
    ],
    [
      /for salary earners/g,
      "for individuals and businesses"
    ],
    [
      /SalaryPlan/g,
      "Budget"
    ]
  ];

  function brandText(s) {
    return typeof s === "string"
      ? BRAND_MAP.reduce(
          (t, m) => t.replace(m[0], m[1]),
          s
        )
      : s;
  }

  ["alert", "confirm", "prompt"].forEach(k => {
    const originalFunction = window[k].bind(window);

    window[k] = (m, d) =>
      originalFunction(brandText(m), d);
  });

  const BRAND_SKIP =
    ".nText,.nItem,.meta,.info,.hxItem,.chItem";

  function sweepBrand() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    const hits = [];
    let node;

    while ((node = walker.nextNode())) {
      if (
        node.nodeValue.indexOf("SalaryPlan") > -1 ||
        node.nodeValue.indexOf("salary earners") > -1
      ) {
        hits.push(node);
      }
    }

    hits.forEach(textNode => {
      const parent = textNode.parentElement;

      if (
        !parent ||
        /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName) ||
        parent.closest(BRAND_SKIP)
      ) {
        return;
      }

      textNode.nodeValue = brandText(textNode.nodeValue);
    });

    document
      .querySelectorAll("[placeholder],[aria-label],[title],[alt]")
      .forEach(element => {
        ["placeholder", "aria-label", "title", "alt"].forEach(attr => {
          const value = element.getAttribute(attr);

          if (
            value &&
            value.indexOf("SalaryPlan") > -1
          ) {
            element.setAttribute(
              attr,
              brandText(value)
            );
          }
        });
      });

    document.title = brandText(document.title);
  }

  let brandTimer = null;

  new MutationObserver(() => {
    clearTimeout(brandTimer);

    brandTimer = setTimeout(
      sweepBrand,
      60
    );
  }).observe(document.body, {
    childList: true,
    subtree: true
  });

  // ---- Calendar files say Budget too ----
  const baseDescOf = descOf;

  descOf = function (n, a) {
    return brandText(baseDescOf(n, a));
  };

  // ---- Header ----
  const minimalHdr =
    document.querySelector("header");

  if (minimalHdr) {
    const brandEl =
      minimalHdr.querySelector(".brand");

    if (
      brandEl &&
      !brandEl.querySelector(".wsLogo")
    ) {
      const lg = logoSvg(30);

      lg.classList.add("brandLogo");

      const h1 =
        brandEl.querySelector("h1");

      if (h1) {
        brandEl.insertBefore(lg, h1);
      } else {
        brandEl.prepend(lg);
      }
    }

    // Prevent duplicate settings button
    let gear =
      document.getElementById("gearBtn");

    if (!gear) {
      gear = document.createElement("button");

      gear.type = "button";
      gear.id = "gearBtn";
      gear.setAttribute(
        "aria-label",
        "Settings"
      );

      gear.innerHTML =
        svgIcon("sliders");

      gear.onclick = () =>
        openPage(
          "Settings",
          settingsPage
        );
    }

    let minimalHdrRight =
      minimalHdr.querySelector(
        ".hdrRight"
      );

    if (!minimalHdrRight) {
      minimalHdrRight =
        document.createElement("div");

      minimalHdrRight.className =
        "hdrRight";

      minimalHdr.appendChild(
        minimalHdrRight
      );
    }

    const month =
      $("month");

    if (
      month &&
      !minimalHdrRight.contains(month)
    ) {
      minimalHdrRight.appendChild(month);
    }

    if (
      gear &&
      !minimalHdrRight.contains(gear)
    ) {
      minimalHdrRight.appendChild(gear);
    }
  }

  // ---- Bottom navigation ----
  if (
    tabButtons &&
    tabButtons.bills &&
    tabButtons.savings
  ) {
    tabButtons.bills.style.display =
      "none";

    tabButtons.savings.style.display =
      "none";
  }

  let plusBtn =
    tabBar.querySelector(".plusBtn");

  if (!plusBtn) {
    plusBtn =
      document.createElement("button");

    plusBtn.type = "button";
    plusBtn.className = "plusBtn";
    plusBtn.setAttribute(
      "aria-label",
      "Add transaction"
    );

    plusBtn.innerHTML =
      svgIcon("plus2");

    plusBtn.onclick = () =>
      fab.onclick();

    tabBar.insertBefore(
      plusBtn,
      tabButtons.reports
    );
  }

  // ---- More button ----
  let moreBtn =
    tabBar.querySelector(
      ".minimalMoreBtn"
    );

  if (!moreBtn) {
    moreBtn =
      document.createElement("button");

    moreBtn.type = "button";
    moreBtn.className =
      "minimalMoreBtn";

    const moreIc =
      mkEl("span", "tabIc");

    moreIc.innerHTML =
      svgIcon("more");

    moreBtn.append(
      moreIc,
      mkEl("div", "", "More")
    );

    moreBtn.onclick = () =>
      openPage(
        "More",
        morePage
      );

    tabBar.appendChild(
      moreBtn
    );
  }

  const baseShowTab2 =
    showTab;

  showTab = function (id) {
    baseShowTab2(id);

    moreBtn.classList.toggle(
      "on",
      id === "bills" ||
      id === "savings"
    );
  };

  // ---- More screen ----
  function srcHandler(label) {
    const pools = [
      qa.querySelectorAll("button"),
      drawer.querySelectorAll(".dItem")
    ];

    for (
      let p = 0;
      p < pools.length;
      p++
    ) {
      const list = pools[p];

      for (
        let i = 0;
        i < list.length;
        i++
      ) {
        const span =
          list[i].querySelector(
            "span:not(.ic)"
          );

        if (
          span &&
          span.textContent === label &&
          list[i].onclick
        ) {
          return list[i].onclick;
        }
      }
    }

    return null;
  }

  function morePage(body) {
    const groups = [
      [
        "Money",
        [
          [
            "Income",
            "plus",
            () =>
              openPage(
                "Income",
                b =>
                  historyPage(
                    b,
                    "income"
                  )
              )
          ],
          [
            "Expenses",
            "minus",
            () =>
              openPage(
                "Expenses",
                b =>
                  historyPage(
                    b,
                    "expense"
                  )
              )
          ],
          ["Bills", "bills"],
          ["Savings", "savings"],
          ["Calendar", "calendar"]
        ]
      ],
      [
        "Tools",
        [
          ["Calculator", "calc"],
          [
            "Currency converter",
            "swap",
            "Converter"
          ],
          ["Notes", "note"]
        ]
      ]
    ];

    if (
      typeof wsEntry !== "undefined" &&
      wsEntry
    ) {
      groups.push([
        "Business",
        [
          ["Books", "list"],
          [
            "Business reports",
            "trend",
            "P&L"
          ]
        ]
      ]);
    }

    groups.push([
      "App",
      [
        ["Workspaces", "grid"],
        ["Settings", "sliders"],
        ["Security", "lock"],
        [
          "Backup and restore",
          "backup"
        ],
        ["How to use", "help"],
        [
          "Privacy and data",
          "shield"
        ],
        ["About", "info"],
        ["Welcome tour", "star"]
      ]
    ]);

    groups.forEach(group => {
      const rows =
        group[1]
          .map(row => ({
            label: row[0],
            icon: row[1],
            fn:
              typeof row[2] ===
              "function"
                ? row[2]
                : srcHandler(
                    row[2] ||
                      row[0]
                  )
          }))
          .filter(row => row.fn);

      if (!rows.length) {
        return;
      }

      body.appendChild(
        mkEl(
          "div",
          "moreGrp",
          group[0]
        )
      );

      rows.forEach(row => {
        const button =
          mkEl(
            "button",
            "moreRow"
          );

        button.type = "button";

        const icon =
          mkEl(
            "span",
            "ic"
          );

        icon.innerHTML =
          svgIcon(row.icon);

        button.append(
          icon,
          mkEl(
            "span",
            "",
            row.label
          ),
          mkEl(
            "span",
            "chev",
            "›"
          )
        );

        button.onclick = () => {
          pageDlg.close();
          row.fn();
        };

        body.appendChild(
          button
        );
      });
    });
  }

  // ---- Small colour dot beside each transaction ----
  const DOT_PAL = [
    "--accent-orange",
    "--accent-red",
    "--accent-green",
    "--accent-teal",
    "--accent-indigo"
  ];

  function dotVar(name) {
    let h = 0;

    for (
      let i = 0;
      i < name.length;
      i++
    ) {
      h =
        (h * 31 +
          name.charCodeAt(i)) >>>
        0;
    }

    return DOT_PAL[h % 5];
  }

  function addDots() {
    document
      .querySelectorAll(
        "#list li .info strong"
      )
      .forEach(strong => {
        if (
          strong.querySelector(
            ".cdt"
          )
        ) {
          return;
        }

        const dot =
          document.createElement(
            "span"
          );

        dot.className = "cdt";

        dot.style.background =
          "var(" +
          dotVar(
            strong.textContent
          ) +
          ")";

        strong.insertBefore(
          dot,
          strong.firstChild
        );
      });
  }

  const listEl = $("list");

  if (listEl) {
    new MutationObserver(
      addDots
    ).observe(listEl, {
      childList: true,
      subtree: true
    });
  }

  // ---- Settings ----
  const baseSettings3 =
    settingsPage;

  settingsPage =
    function (body) {
      baseSettings3(body);

      Array.from(
        body.querySelectorAll(
          ".pCard"
        )
      ).forEach(card => {
        const heading =
          card.querySelector(
            "h3"
          );

        if (
          heading &&
          heading.textContent ===
            "Appearance"
        ) {
          card.remove();
        }
      });
    };

  // ---- Logo on lock screen ----
  const lockBrandEl =
    lockDlg &&
    lockDlg.querySelector(
      ".lockBrand"
    );

  if (lockBrandEl) {
    const lockLogo =
      logoSvg(56);

    lockLogo.style.marginBottom =
      "12px";

    lockDlg.insertBefore(
      lockLogo,
      lockBrandEl
    );
  }

  // ---- Logo on welcome screen ----
  const welLogoEl =
    document.querySelector(
      ".welLogo"
    );

  if (welLogoEl) {
    welLogoEl.textContent = "";

    welLogoEl.appendChild(
      logoSvg(64)
    );
  }

  // ---- Remove old Home charts ----
  const oldChartBody =
    document.getElementById(
      "chartBody"
    );

  if (oldChartBody) {
    const oldSec =
      oldChartBody.parentElement;

    TABS[0].parts =
      TABS[0].parts.filter(
        p => p !== oldSec
      );

    oldSec.style.display =
      "none";
  }

  // ---- Final refresh ----
  sweepBrand();
  addDots();

})();
