# EO Interactive Site Deployment

This `docs/` folder is ready for GitHub Pages deployment.

## Publish Steps

1. Push this repository to GitHub.
2. Open the repository `Settings`.
3. Open `Pages`.
4. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: your main branch
   - `Folder`: `/docs`
5. Save and wait for GitHub Pages to publish.

## Expected URL

After deployment, the site will be available at:

`https://<your-github-username>.github.io/<your-repository-name>/`

## Local Preview

Run:

```bash
cd docs
python3 -m http.server 8765
```

Then open:

`http://localhost:8765/`
