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

.PHONY: all clean run run-classic run-llm run-autoplay run-autoplay-web run-autoplay-web-insecure install-llm dependency-check dependency-check-quick

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
#   make install-llm    — One-time: npm install in adventure-llm (needed before run-llm / run-autoplay).
#   make run-llm        — Interactive NL: builds adventure-llm then runs the CLI (natural language at >).
#   make run-autoplay      — Self-acting: builds adventure-llm then runs with --autoplay (LLM drives moves).
#   make run-autoplay-web  — LLM autoplay + local HTTPS dashboard (runs web:tls-init once if needed).
#   make run-autoplay-web-insecure — Same with plain HTTP (ADVENTURE_LLM_WEB_INSECURE_HTTP=1).
#
# Configure LLM env in adventure-llm/.env (see adventure-llm/.env.example). Pass CLI flags after --:
#   cd adventure-llm && npm start -- --classic
# -----------------------------------------------------------------------------

# Classic Fortran only.
run: $(TARGET)
	./$(TARGET)

run-classic: run

# One-time or refresh of Node dependencies for adventure-llm.
install-llm:
	cd adventure-llm && npm install --no-audit --no-fund

# Interactive natural language (requires install-llm once, and LLM credentials in adventure-llm/.env).
run-llm: $(TARGET)
	cd adventure-llm && npm run build && npm start

# Autoplay: LLM plans each move (--autoplay). Cannot combine with --classic.
run-autoplay: $(TARGET)
	cd adventure-llm && npm run build && npm start -- --autoplay

run-autoplay-web: $(TARGET)
	cd adventure-llm && npm run build && (test -f .cache/tls/dev-cert.pem || npm run web:tls-init) && npm run web

# Same as run-autoplay-web but plain HTTP if you cannot run web:tls-init (OpenSSL 1.1.1+).
run-autoplay-web-insecure: $(TARGET)
	cd adventure-llm && npm run build && ADVENTURE_LLM_WEB_INSECURE_HTTP=1 npm run web

# OWASP Dependency-Check (install: brew install dependency-check).
# Run from repo root; requires npm install in adventure-llm first.
# Optional: export NVD_API_KEY from https://nvd.nist.gov/developers/request-an-api-key
# If NVD update fails with HTTP 429, run `make dependency-check-quick` (uses local cache).
dependency-check:
	cd adventure-llm && npm install --no-audit --no-fund
	cd adventure-llm && mkdir -p ./reports/dependency-check
	cd adventure-llm && \
	  if [ -n "$$NVD_API_KEY" ]; then \
	    dependency-check --nvdApiKey "$$NVD_API_KEY" --project adventure-llm --scan . --out ./reports/dependency-check --format HTML --format JSON; \
	  else \
	    dependency-check --project adventure-llm --scan . --out ./reports/dependency-check --format HTML --format JSON; \
	  fi

# Same scan but skips NVD/CVE DB update (faster; avoids 429 when API key not set).
dependency-check-quick:
	cd adventure-llm && npm install --no-audit --no-fund
	cd adventure-llm && mkdir -p ./reports/dependency-check
	cd adventure-llm && dependency-check --noupdate --project adventure-llm --scan . --out ./reports/dependency-check --format HTML --format JSON
