
### Commit Message Format

```
<emoji> <type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

---

### Types with Emojis

| Emoji | Type         | When to use                        |
| ----- | ------------ | ---------------------------------- |
| ✨     | **feat**     | A new feature                      |
| 🐛    | **fix**      | Bug fix                            |
| 📝    | **docs**     | Documentation only changes         |
| 💄    | **style**    | Code style/formatting only         |
| ♻️    | **refactor** | Code change without feature or fix |
| ⚡️    | **perf**     | Performance improvements           |
| ✅     | **test**     | Adding or updating tests           |
| 🔧    | **chore**    | Maintenance / tooling changes      |
| 🏗️   | **build**    | Build system / dependencies        |
| 🤖    | **ci**       | CI/CD changes                      |
| ⏪️    | **revert**   | Reverting commits                  |
| 🔒️   | **security** | Security fixes                     |

---

### Scopes (opcional)

Usa pra deixar mais claro onde mexeu:

* `auth`
* `api`
* `database`
* `ui`
* `frontend`
* `backend`
* `mobile`
* `config`
* `deps`
* `docker`

Exemplo:

```
✨ feat(auth): add refresh token support
🐛 fix(api): handle null response on login
```

---

### Regras boas de commit

* descrição curta (até ~72 caracteres)
* verbo no infinitivo ou imperativo: "add", "fix", "remove"
* sem ponto final
* commits pequenos e objetivos
* um commit = uma ideia

---

### Exemplos mais completos

```bash
✨ feat(auth): add refresh token rotation for improved security

✨ feat(chat): implement real-time message streaming via websocket

🐛 fix(api): handle null response when user has no profile

🐛 fix(ui): correct button alignment on mobile screens

📝 docs(readme): include setup steps for Windows and Linux

📝 docs(api): add missing request/response schema for login route

💄 style: run prettier across entire codebase

💄 style(header): adjust spacing and font sizes in navbar

♻️ refactor(user-service): split large service into smaller modules

♻️ refactor(handlers): remove duplicated validation logic

⚡️ perf(database): add index to improve query performance on messages table

⚡️ perf(cache): reduce redis calls in feed generation

✅ test(auth): add coverage for expired token cases

✅ test(api): add integration tests for user registration flow

🔧 chore(deps): update axios to latest stable version

🔧 chore(env): improve environment variable validation

🏗️ build(docker): optimize image size using multi-stage build

🏗️ build(webpack): enable code splitting for faster load times

🤖 ci(github): add caching for node_modules in pipeline

🤖 ci(actions): run tests on pull request and main branch

⏪️ revert(api): rollback pagination change due to performance issues

🔒️ security(auth): block brute force login attempts after 5 failures
```

---
### Important Rules

**NEVER** include these lines in commits:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```