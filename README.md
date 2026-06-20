# To-Do Notes

To-Do Notes is a simple mobile-first web app for saving tasks and short notes. It is built with React and Vite and stores all data in the browser using `localStorage`.

## Features

- Add a task or note
- Edit an existing note
- Delete a note
- Mark a task as completed or active
- Search notes instantly
- Filter notes by All, Active, or Completed
- View simple statistics for total, completed, and active notes
- Automatic saving in browser `localStorage`
- Clean light theme designed for Android phone screens

## Tech stack

- React
- Vite
- Plain CSS
- Browser `localStorage`
- No backend for version 1

## Local development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Render deployment settings

Use Render Static Site with these settings:

- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Branch: `main`

## Limitations

- Data is saved only in the current browser and device.
- There is no account login or cloud sync in version 1.
- Clearing browser data removes saved notes.
