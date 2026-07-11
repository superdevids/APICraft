---
name: Feature request
about: Suggest an idea for APICraft
title: ''
labels: enhancement
assignees: ''

---

## Is Your Feature Request Related to a Problem?

A clear and concise description of what the problem is.

**Example:** I'm always frustrated when I have to manually [...].

## Describe the Solution You'd Like

A clear and concise description of what you want to happen.

### API or Usage Example

```typescript
// Show how you envision the feature working
@api('/example')
class ExampleAPI {
  @get('/')
  @yourNewFeature({ option: 'value' })
  async handler() {
    return { result: true }
  }
}
```

### Expected Output

```
// What the generated output should look like
```

## Describe Alternatives You've Considered

A clear and concise description of any alternative solutions or features you've considered.

- Alternative 1: [...]
- Alternative 2: [...]

## Target Audience

Who would benefit from this feature?

- [ ] API developers using APICraft
- [ ] Frontend developers consuming generated SDKs
- [ ] API consumers using generated documentation
- [ ] Contributors extending APICraft
- [ ] Other: [...]

## Impact

- **Complexity:** [Low / Medium / High] — How complex would this feature be to implement?
- **Breaking change:** [Yes / No] — Would this require changes to existing APIs?

## Additional Context

Add any other context, screenshots, references, or examples about the feature request here.

- Links to similar features in other frameworks
- Design mockups or diagrams
- Related issues or discussions
