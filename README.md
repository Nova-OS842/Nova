# Nova OS 10.0

Major platform update: account-backed Nova Cloud sync, animated desktop wallpapers, active-player presence, global Nova Chat notifications, guest restrictions for Chat/Meet, and server-backed Nova Watch content.

Passwords are stored as scrypt hashes on the Nova server; Nova never stores readable passwords in the browser or database.

Run with `npm start` (default port 8080). The server stores account data in `data/data.json`.

## Nova 10.3 additions
- Desktop app icons use a snap grid and only land in available grid slots.
- Signed-in desktop layouts are saved through Nova Cloud; guest layouts are not saved.
- Nova Beat Lab includes a larger preset library, more instruments, swing, randomize, clear, volume, custom sounds, and saved beats.
- Nova Music automatically scans `assets/music/` for MP3/WAV/OGG/M4A files through `/api/content/music`.
- Recommended music filename format: `Artist - Song Name.mp3`.
- `assets/nova-app-icons-no-text.png` is a text-free visual board made from Nova's current Shop, Music, Games, Movies icon assets.
## Web game links

Nova Gaming supports both local HTML games in `games/` and web-hosted games. To add a web game, edit `data/games.js` and add an object to `window.NovaGameLinks`:

```js
window.NovaGameLinks = [
  { title: "My Web Game", url: "https://example.com/game/", poster: "", description: "Ready to play in Nova." },
];
```

Use the full `https://` URL of the game page. Local `.html` games and linked games appear together in Nova Gaming. Linked games are not copied into the Nova server; Nova loads them from their original web address.

## Game posters
Every game in `data/games.js` has a `poster` field. Set it to a web image URL or a local poster path such as `assets/posters/peggle.jpg`. If `poster` is left blank, Nova also checks `assets/posters/<game-file-name-without-.html>.jpg` automatically.


## Nova Watch Shows
The Nova Watch navigation includes a Shows section. It currently displays a coming-soon state and does not start show playback.

When Shows is enabled later, the catalog is designed around one TMDB series ID per show rather than one embed URL per episode. CineSRC documents TV embeds as `https://cinesrc.st/embed/tv/{tmdb_id}/{season}/{episode}`, so Nova can generate each episode URL from the show ID, season, and episode number.

## Nova Watch Shows

Shows use one catalog entry per show. You do not paste an episode URL for every episode. Add the show's TMDB ID and the number of episodes in each season to `data/shows.js`; Nova generates CineSRC TV embed URLs automatically as `https://cinesrc.st/embed/tv/{tmdbId}/{season}/{episode}?autoplay=true`.

Example:
```js
{
  id: "my-show",
  title: "My Show",
  tmdbId: 12345,
  poster: "https://image.tmdb.org/t/p/original/example.jpg",
  year: 2026,
  genre: "Drama",
  maturityRating: "TV-14",
  description: "Show description.",
  seasons: [
    { number: 1, episodes: 10 },
    { number: 2, episodes: 8 }
  ]
}
```
Nova's Shows details page lets viewers choose a season and episode, then launches that episode in the CineSRC player with autoplay requested. Nova also listens for CineSRC's ended event to advance to the next episode when the provider reports completion.


## 11.5.1 — Shows card sizing fix
Show cards now use the same 2:3 sizing as movie cards so posters and show cards render correctly.

## 11.6.0 — Desktop & Media Update

- Added Windows-style window resizing from all edges and corners.
- Updated Games cards so complete artwork remains visible without cropping.
- Reworked Nova Watch with a cinematic streaming layout and improved hero/navigation.
- Increased movie card and shelf spacing so posters are clearly separated.
- Added a live desktop status HUD with Nova branding, online status, and clock.
- Added a glass welcome panel and richer desktop lighting/grid atmosphere.
- Preserved the existing apps, desktop icon system, taskbar, windows, and content.


## Developer Panel
Set the server environment variable `NOVA_DEV_PASSWORD` (or comma-separated `NOVA_DEV_PASSWORDS`) before starting Nova. Developer bypass is server-authorized and opens the Developer Panel from the taskbar. Movies, HTML games, and linked games are written to the server project files so they are shared by guests and accounts.

The Server switch is implemented as persistent Nova maintenance mode: normal APIs and account services are unavailable while offline, while the control endpoint remains available so a developer can turn services back on.

Account data, including Nova Cloud preferences/history such as watched movies and played games, continues to sync through `/api/sync`. Banned accounts are blocked at login and their active sessions are invalidated.
