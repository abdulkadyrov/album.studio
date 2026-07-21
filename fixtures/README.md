# Test fixtures

Фикстуры синтетические и не содержат реальных учеников, фотографий или школ.

- `test-class.vsclass` — безопасный `.vsclass` с 8 учениками, 1 учителем и SVG-аватарами.
- `large-project.fixture.json` — большой canvas document для профилирования: 40 страниц и 400 слоёв.

Перегенерация:

```bash
npm run fixtures:generate
```

После изменения форматов `.vsclass`, canvas document или import/export pipeline фикстуры нужно
перегенерировать и прогнать полный release-check из `TESTING.md`.
