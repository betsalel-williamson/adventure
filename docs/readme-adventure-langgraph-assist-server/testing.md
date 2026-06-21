# Testing

From `adventure-langgraph/`:

```bash
npm test -- packages/assist-server
npm run test:cucumber   # includes @assist wire features
```

Assist server restarts on source changes when using `npm run assist:dev` (`tsx watch` on `packages/assist-server` and imported `map-core` sources).
