# Build Colossal Cave Adventure (Fortran 77).
# Requires GNU Fortran (gfortran), which implements the extensions this code uses
# (e.g. GETARG, IARGC, RAN).

# GNU make defaults FC to f77; force gfortran unless overridden (e.g. make FC=ifort).
FC := gfortran
# Compatibility: gfortran 10+ rejects some legacy calls without these flags.
EXTRA_FFLAGS ?= -std=legacy -fallow-argument-mismatch
FFLAGS ?= -O2 -Wall $(EXTRA_FFLAGS)

TARGET := adventure
SRC := adventure.f

.PHONY: all clean run run-classic run-lm run-autoplay run-autoplay-web run-autoplay-web-insecure install-lm dependency-check dependency-check-quick

all: $(TARGET)

$(TARGET): $(SRC)
	$(FC) $(FFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)

# -----------------------------------------------------------------------------
# Run modes (from repo root so OPEN(1,FILE='ADVENTURE.DAT') finds adventure.dat)
# -----------------------------------------------------------------------------
#
#   make run            — Classic Fortran TTY only (./adventure). No Node.
#   make run-classic    — Same as `make run`.
#
#   make install-lm     — One-time: npm install in adventure-lm (needed before run-lm / run-autoplay).
#   make run-lm         — Interactive NL: builds adventure-lm then runs the CLI (natural language at >).
#   make run-autoplay      — Self-acting: builds adventure-lm then runs with --autoplay (LLM drives moves).
#   make run-autoplay-web  — LLM autoplay + local HTTPS dashboard (runs web:tls-init once if needed).
#   make run-autoplay-web-insecure — Same with plain HTTP (ADVENTURE_LM_WEB_INSECURE_HTTP=1).
#
# Configure LLM env in adventure-lm/.env (see adventure-lm/.env.example). Pass CLI flags after --:
#   cd adventure-lm && npm start -- --classic
# -----------------------------------------------------------------------------

# Classic Fortran only.
run: $(TARGET)
	./$(TARGET)

run-classic: run

# One-time or refresh of Node dependencies for adventure-lm.
install-lm:
	cd adventure-lm && npm install --no-audit --no-fund

# Interactive natural language (requires install-lm once, and LLM credentials in adventure-lm/.env).
run-lm: $(TARGET)
	cd adventure-lm && npm run build && npm start

# Autoplay: LLM plans each move (--autoplay). Cannot combine with --classic.
run-autoplay: $(TARGET)
	cd adventure-lm && npm run build && npm start -- --autoplay

run-autoplay-web: $(TARGET)
	cd adventure-lm && npm run build && (test -f .cache/tls/dev-cert.pem || npm run web:tls-init) && npm run web

# Same as run-autoplay-web but plain HTTP if you cannot run web:tls-init (OpenSSL 1.1.1+).
run-autoplay-web-insecure: $(TARGET)
	cd adventure-lm && npm run build && ADVENTURE_LM_WEB_INSECURE_HTTP=1 npm run web

# OWASP Dependency-Check (install: brew install dependency-check).
# Run from repo root; requires npm install in adventure-lm first.
# Optional: export NVD_API_KEY from https://nvd.nist.gov/developers/request-an-api-key
# If NVD update fails with HTTP 429, run `make dependency-check-quick` (uses local cache).
dependency-check:
	cd adventure-lm && npm install --no-audit --no-fund
	cd adventure-lm && mkdir -p ./reports/dependency-check
	cd adventure-lm && \
	  if [ -n "$$NVD_API_KEY" ]; then \
	    dependency-check --nvdApiKey "$$NVD_API_KEY" --project adventure-lm --scan . --out ./reports/dependency-check --format HTML --format JSON; \
	  else \
	    dependency-check --project adventure-lm --scan . --out ./reports/dependency-check --format HTML --format JSON; \
	  fi

# Same scan but skips NVD/CVE DB update (faster; avoids 429 when API key not set).
dependency-check-quick:
	cd adventure-lm && npm install --no-audit --no-fund
	cd adventure-lm && mkdir -p ./reports/dependency-check
	cd adventure-lm && dependency-check --noupdate --project adventure-lm --scan . --out ./reports/dependency-check --format HTML --format JSON
