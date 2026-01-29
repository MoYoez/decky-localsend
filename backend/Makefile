.PHONY: all build clean

SUBMODULE_DIR := localsend
OUT_DIR := out
BINARY_NAME := localsend-core

all: build

build:
	@if [ ! -f "$(SUBMODULE_DIR)/go.mod" ]; then \
		echo "localsend submodule missing. Run: git submodule update --init --recursive"; \
		exit 1; \
	fi
	mkdir -p "$(OUT_DIR)"
	cd "$(SUBMODULE_DIR)" && \
		CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOPROXY=goproxy.cn,direct \
		go build -trimpath -ldflags "-s -w" -o "../$(OUT_DIR)/$(BINARY_NAME)" .

clean:
	rm -f "$(OUT_DIR)/$(BINARY_NAME)"