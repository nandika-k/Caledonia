<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Grove data lives behind `GroveRepository` (src/lib/grove/repository.ts); swap the implementation to connect real NJIT Highlander data without touching visuals.
- Tree-level thresholds and milestones live only in src/lib/grove/config.ts so they stay easy to tune.
- The Grove renders as a client-only React Three Fiber scene (src/components/grove3d, lazy-loaded); CC0 Kenney GLB trunks and shared procedural branch/leaf crowns use drei instances because WebGL cannot render on the server and batching keeps many trees efficient.
