# Форматы данных

## `.vsclass`

`.vsclass` — ZIP-пакет класса для локального импорта учеников, учителей и фотографий. Импорт работает в два шага: сначала staged preview без изменения проекта, затем транзакционная запись выбранной стратегией.

```text
class.vsclass
├── manifest.json
└── assets/
    ├── ivanov.jpg
    └── ...
```

Минимальный `manifest.json`:

```json
{
  "format": "vakha-class",
  "version": 1,
  "class": {
    "schoolName": "Школа №25",
    "className": "4А",
    "academicYear": "2026"
  },
  "students": [
    {
      "externalId": "student-001",
      "firstName": "Александр",
      "lastName": "Иванов",
      "status": "ready",
      "photos": [
        {
          "path": "assets/ivanov.jpg",
          "role": "main",
          "order": 0,
          "mimeType": "image/jpeg",
          "byteSize": 123456
        }
      ]
    }
  ],
  "teachers": []
}
```

Поддерживаемые статусы: `new`, `needs-photo`, `needs-review`, `ready`, `approved`, `hidden`.

Стратегии повторного импорта:

- `append` — добавить всех как новых участников;
- `merge` — обновить совпадения по `type + externalId`, а если `externalId` нет, по типу и ФИО;
- `replace` — заменить текущий список класса в проекте.

Проверки безопасности:

- общий размер пакета — не более 500 МБ;
- не более 5000 файлов;
- абсолютные пути и `..` отклоняются;
- фотографии должны лежать в `assets/`;
- поддерживаются `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`;
- если указан `byteSize`, фактический размер ресурса должен совпасть;
- preview не записывает участников, фотографии или метаданные проекта.
