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

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(SRC)
	$(FC) $(FFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)

# Run from the project root so OPEN(1,FILE='ADVENTURE.DAT') finds adventure.dat.
run: $(TARGET)
	./$(TARGET)
