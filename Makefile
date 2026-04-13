# Colossal Cave Adventure — Fortran 77 + adventure-nl (Node.js).
#
# Fortran requires GNU Fortran (gfortran); this code uses extensions such as GETARG,
# IARGC, and RAN. Run modes that execute the game assume cwd is the repo root so
# OPEN(1,FILE='ADVENTURE.DAT') finds adventure.dat.
#
# Quick reference:
#   make run / run-nl / run-autoplay / run-autoplay-web — see “Execution modes” below.
#   make smoke-build / smoke / qa — compile smoke, tests, full QA gate.
#   make dependency-check / dependency-check-quick — OWASP Dependency-Check (brew).
#
# LLM env: adventure-nl/.env (see adventure-nl/.env.example). Extra CLI flags:
#   npm --prefix adventure-nl start -- --classic

# =============================================================================
# Variables
# =============================================================================

# GNU make defaults FC to f77; force gfortran unless overridden (e.g. make FC=ifort).
FC := gfortran
# Compatibility: gfortran 10+ rejects some legacy calls without these flags.
EXTRA_FFLAGS ?= -std=legacy -fallow-argument-mismatch
FFLAGS ?= -O2 -Wall $(EXTRA_FFLAGS)

TARGET := adventure
SRC := adventure.f

NL_DIR := adventure-nl
NL_PKG := $(NL_DIR)/package.json
NL_LOCK := $(NL_DIR)/package-lock.json
NL_REPORTS := $(NL_DIR)/reports/dependency-check

NPM := npm
NPM_RUN := $(NPM) --prefix $(NL_DIR) run

# =============================================================================
# Phony targets
# =============================================================================
.PHONY: all clean \
	run run-classic \
	install-nl build-nl \
	run-nl run-autoplay run-autoplay-web run-autoplay-web-insecure \
	smoke smoke-build qa \
	dependency-check dependency-check-quick

# =============================================================================
# Default & Fortran build
# =============================================================================

all: $(TARGET)

$(TARGET): $(SRC)
	$(FC) $(FFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)
	rm -rf $(NL_DIR)/dist $(NL_DIR)/node_modules

# =============================================================================
# Node.js — install & build helpers
# =============================================================================

$(NL_DIR)/node_modules: $(NL_PKG) $(NL_LOCK)
	$(NPM) install --prefix $(NL_DIR) --no-audit --no-fund

install-nl: $(NL_DIR)/node_modules

build-nl: $(NL_DIR)/node_modules
	$(NPM_RUN) build

# =============================================================================
# Execution modes
# =============================================================================
#
#   make run / run-classic — Classic Fortran TTY only (./adventure). No Node.
#   make run-nl            — Interactive NL CLI (builds NL first).
#   make run-autoplay      — Self-acting CLI (--autoplay).
#   make run-autoplay-web  — Local HTTPS dashboard (web:tls-init if no dev cert).
#   make run-autoplay-web-insecure — Plain HTTP (ADVENTURE_NL_WEB_INSECURE_HTTP=1).
#

run run-classic: $(TARGET)
	./$(TARGET)

run-nl: $(TARGET) build-nl
	$(NPM_RUN) start

run-autoplay: $(TARGET) build-nl
	$(NPM_RUN) start -- --autoplay

run-autoplay-web: $(TARGET) build-nl
	@test -f $(NL_DIR)/.cache/tls/dev-cert.pem || $(NPM_RUN) web:tls-init
	$(NPM_RUN) web

run-autoplay-web-insecure: $(TARGET) build-nl
	ADVENTURE_NL_WEB_INSECURE_HTTP=1 $(NPM_RUN) web

# =============================================================================
# Smoke test & QA
# =============================================================================
#
#   make smoke-build — Fortran + adventure-nl production build (no Vitest).
#   make smoke        — smoke-build + npm test (Vitest).
#   make qa           — lint, Prettier --check, full build, npm run check (deps + tsc --noEmit + tests).
#
# OWASP CVE reports: dependency-check / dependency-check-quick (separate tool).
#

smoke-build: $(TARGET) build-nl

smoke: smoke-build
	$(NPM_RUN) test

qa: $(TARGET) install-nl
	$(NPM_RUN) lint
	$(NPM_RUN) format:check
	$(NPM_RUN) build
	$(NPM_RUN) check

# =============================================================================
# Security — OWASP Dependency-Check
# =============================================================================
#
# Install: brew install dependency-check
# Optional: export NVD_API_KEY (https://nvd.nist.gov/developers/request-an-api-key).
# If NVD update fails with HTTP 429, use dependency-check-quick (local cache).
#

dependency-check: install-nl
	mkdir -p $(NL_REPORTS)
	dependency-check --project adventure-nl --scan $(NL_DIR) \
		--out $(NL_REPORTS) --format HTML --format JSON \
		$(if $(NVD_API_KEY),--nvdApiKey "$(NVD_API_KEY)",)

dependency-check-quick: install-nl
	mkdir -p $(NL_REPORTS)
	dependency-check --noupdate --project adventure-nl --scan $(NL_DIR) \
		--out $(NL_REPORTS) --format HTML --format JSON
