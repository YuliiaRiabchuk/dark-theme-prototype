/* Прототип темної теми: перемикач, редактор токенів, перевірка контрасту,
 * експорт. Ніякої збірки — сторінка відкривається файлом.
 *
 * Значення живуть у tokens.css. Редактор не чіпає файл: він пише inline-стилі
 * на <html>, а «Експорт» збирає з них готовий CSS-блок, щоб перенести правки
 * у продукт одним копіюванням. Тому закрити вкладку = скасувати правки.
 */

const root = document.documentElement

/* Групи — у тому ж порядку, що в продукті: спершу ґрунт, потім текст, потім
   семантика. Редагуються лише кольори: тіні й розміри правити на око шкідливо. */
const GROUPS = [
  {
    title: 'Ґрунт і межі',
    tokens: [
      '--color-shell',
      '--color-canvas',
      '--color-bg',
      '--color-card',
      '--color-muted',
      '--color-border',
      '--color-border-strong',
    ],
  },
  {
    title: 'Текст',
    tokens: ['--color-fg', '--color-fg-2', '--color-muted-fg', '--color-subtle'],
  },
  {
    title: 'Головна кнопка',
    tokens: ['--color-primary', '--color-primary-fg', '--color-on-solid'],
  },
  {
    title: 'Акцент',
    tokens: ['--color-accent', '--color-accent-soft', '--color-accent-fg'],
  },
  {
    title: 'Наявність (зелений)',
    tokens: ['--color-success', '--color-success-soft', '--color-success-fg'],
  },
  {
    title: 'Оренда (янтарний)',
    tokens: ['--color-warning', '--color-warning-soft', '--color-warning-fg'],
  },
  {
    title: 'Ремонт (червоний)',
    tokens: ['--color-danger', '--color-danger-soft', '--color-danger-fg'],
  },
  {
    title: 'Резерв (жовтий)',
    tokens: ['--color-info', '--color-info-soft', '--color-info-fg'],
  },
  {
    title: 'Комплект (фіолетовий)',
    tokens: ['--color-violet', '--color-violet-soft', '--color-violet-fg'],
  },
]

const EDITED = new Map()

/* ─── колір у rgb: oklch і color-mix браузер сам не розкладає ──────── */

const probe = document.createElement('canvas')
probe.width = probe.height = 1
const ctx = probe.getContext('2d', { willReadFrequently: true })

function toRgb(value) {
  ctx.fillStyle = '#000'
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

function hex(value) {
  const [r, g, b] = toRgb(value)
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

function luminance([r, g, b]) {
  const channel = (x) => {
    x /= 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const one = luminance(toRgb(a))
  const two = luminance(toRgb(b))
  const [hi, lo] = one > two ? [one, two] : [two, one]
  return (hi + 0.05) / (lo + 0.05)
}

function tokenValue(name) {
  return getComputedStyle(root).getPropertyValue(name).trim()
}

/* ─── тема ────────────────────────────────────────────────────────── */

const themeSwitch = document.getElementById('theme-switch')
const themeLabel = document.getElementById('theme-label')
const editingTheme = document.getElementById('editing-theme')

function setTheme(dark) {
  root.classList.toggle('dark', dark)
  themeSwitch.setAttribute('aria-checked', String(dark))
  themeLabel.textContent = dark ? 'Темна' : 'Світла'
  editingTheme.textContent = dark ? 'темної' : 'світлої'
  // Правки прив'язані до теми, у якій їх зробили: при перемиканні скидаємо,
  // інакше тёмные значення потекли б у світлу тему.
  clearEdits()
  render()
}

themeSwitch.addEventListener('click', () => {
  setTheme(themeSwitch.getAttribute('aria-checked') !== 'true')
})

/* ─── редактор ────────────────────────────────────────────────────── */

function clearEdits() {
  for (const name of EDITED.keys()) root.style.removeProperty(name)
  EDITED.clear()
  const out = document.getElementById('export-out')
  out.hidden = true
  out.value = ''
}

document.getElementById('reset').addEventListener('click', () => {
  clearEdits()
  render()
})

function applyToken(name, value) {
  // Пусте поле — повернути значення теми, а не писати порожнечу.
  if (!value.trim()) {
    root.style.removeProperty(name)
    EDITED.delete(name)
  } else {
    root.style.setProperty(name, value)
    EDITED.set(name, value)
  }
  renderContrast()
}

const tokensHost = document.getElementById('tokens')

function render() {
  tokensHost.innerHTML = ''
  for (const group of GROUPS) {
    const box = document.createElement('div')
    box.className = 'token-group'
    const title = document.createElement('h3')
    title.textContent = group.title
    box.append(title)

    for (const name of group.tokens) {
      const row = document.createElement('div')
      row.className = 'token-row'

      const swatch = document.createElement('div')
      swatch.className = 'swatch'
      swatch.dataset.token = name
      swatch.style.background = `var(${name})`

      const right = document.createElement('div')
      const label = document.createElement('div')
      label.className = 'token-name'
      label.textContent = name.replace('--color-', '')
      const input = document.createElement('input')
      input.className = 'token-input'
      input.value = tokenValue(name)
      input.spellcheck = false
      input.addEventListener('input', () => applyToken(name, input.value))
      right.append(label, input)

      row.append(swatch, right)
      box.append(row)
    }
    tokensHost.append(box)
  }
  renderContrast()
}

/* ─── контраст ────────────────────────────────────────────────────── */

const CONTRAST_PAIRS = [
  ['основний текст', '--color-fg', '--color-card'],
  ['другорядний', '--color-fg-2', '--color-card'],
  ['приглушений', '--color-muted-fg', '--color-card'],
  ['підказка', '--color-subtle', '--color-card'],
  ['акцент', '--color-accent', '--color-card'],
  ['наявність', '--color-success', '--color-card'],
  ['оренда', '--color-warning', '--color-card'],
  ['ремонт', '--color-danger', '--color-card'],
  ['підпис по заливці', '--color-on-solid', '--color-danger'],
  ['текст по зеленій підкладці', '--color-success-fg', '--color-success-soft'],
  ['текст по червоній підкладці', '--color-danger-fg', '--color-danger-soft'],
]

function renderContrast() {
  const table = document.getElementById('contrast')
  table.innerHTML = ''
  for (const [title, fg, bg] of CONTRAST_PAIRS) {
    const ratio = contrast(tokenValue(fg), tokenValue(bg))
    const tr = document.createElement('tr')
    const name = document.createElement('td')
    name.textContent = title
    name.className = 'label'
    const value = document.createElement('td')
    value.className =
      'num ' + (ratio >= 4.5 ? 'ratio-pass' : ratio >= 3 ? 'ratio-warn' : 'ratio-fail')
    value.textContent = ratio.toFixed(2)
    tr.append(name, value)
    table.append(tr)
  }
}

/* ─── експорт ─────────────────────────────────────────────────────── */

document.getElementById('export').addEventListener('click', () => {
  const out = document.getElementById('export-out')
  out.hidden = false

  if (EDITED.size === 0) {
    out.value =
      '/* Нічого не змінено. Поправте значення в полях вище — тут зʼявиться\n   готовий блок для вставки у packages/ui/src/styles/theme.css. */'
    return
  }

  const dark = root.classList.contains('dark')
  const selector = dark ? '.dark' : ':root'
  const lines = [...EDITED.entries()].map(
    ([name, value]) => `  ${name}: ${value.trim()};`,
  )
  out.value =
    `/* ${dark ? 'Темна' : 'Світла'} тема — ${EDITED.size} ` +
    `${EDITED.size === 1 ? 'значення' : 'значень'} змінено.\n` +
    `   Вставити у packages/ui/src/styles/theme.css, у блок ${selector}. */\n` +
    `${selector} {\n${lines.join('\n')}\n}\n`
  out.select()
})

setTheme(true)
