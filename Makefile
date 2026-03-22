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

.PHONY: all clean run dependency-check dependency-check-quick

all: $(TARGET)

$(TARGET): $(SRC)
	$(FC) $(FFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)

# Run from the project root so OPEN(1,FILE='ADVENTURE.DAT') finds adventure.dat.
run: $(TARGET)
	./$(TARGET)

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
