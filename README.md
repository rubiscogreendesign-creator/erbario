# Il mio erbario

Archivio personale digitale di piante, organizzato per famiglia botanica.

## Come aggiungere una pianta

1. Apri il file `data/plants.json` su GitHub
2. Clicca sull'icona matita (Edit)
3. Copia il blocco di una pianta esistente e incolla in fondo alla lista (prima della `]`)
4. Modifica i campi con i dati della nuova pianta
5. Clicca "Commit changes"
6. In un minuto la scheda appare online

## Struttura di una scheda

```json
{
  "id": "nome-breve-pianta",
  "scientific_name": "Nome scientifico",
  "common_names": ["Nome comune 1", "Nome comune 2"],
  "family": "Famiglia",
  "subfamily": "Sottofamiglia (opzionale)",
  "genus": "Genere",
  "species": "epiteto specifico",
  "images": ["URL dell'immagine (opzionale — se vuoto prende da Wikipedia)"],
  "wikipedia_title": "Titolo_pagina_Wikipedia_con_underscore",
  "origin": "Area di origine",
  "notes": "Note personali",
  "anecdote": "Aneddoti / curiosità",
  "tags": ["tag1", "tag2"],
  "date_added": "2026-04-18"
}
```

## Campi obbligatori
- `id`, `scientific_name`, `family`

Tutti gli altri campi sono opzionali. Se `images` è vuoto, l'app tenta di recuperare la foto principale da Wikipedia.

## Tecnologia
Sito statico, nessun backend. I dati vivono in questo repository come JSON. Le foto sono riferite tramite URL (principalmente Wikimedia Commons).
