.PHONY: all build clean

SUBMODULE_DIR := localsend
WEB_DIR := $(SUBMODULE_DIR)/web
OUT_DIR := out
BINARY_NAME := localsend-core

all: build

build:
	@if [ ! -f "$(SUBMODULE_DIR)/go.mod" ]; then \
		echo "localsend submodule missing. Run: git submodule update --init --recursive"; \
		exit 1; \
	fi
	mkdir -p "$(OUT_DIR)"
	mkdir -p "$(OUT_DIR)/web"
	@sudo pacman -Syyu --noconfirm
	@sudo pacman -Sy --noconfirm npm
	cd "$(SUBMODULE_DIR)" && \
		CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
		go build -trimpath -ldflags "-s -w" -o "../$(OUT_DIR)/$(BINARY_NAME)" .
	@if [ -d "$(WEB_DIR)" ]; then \
		cd "$(WEB_DIR)" && \
		npm install && npm run build; \
		cd "$(CURDIR)" && cp -r "$(WEB_DIR)/out/" "$(OUT_DIR)/web/"; \
	fi

clean:
	rm -f "$(OUT_DIR)/$(BINARY_NAME)"