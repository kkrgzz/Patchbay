# Patchbay

Patchbay is a single-user Tauri 2 desktop planner for network cabinets. A versioned JSON document with the `.rackplan` extension stores one cabinet, its two faces, connections, colours, draft and work checklist. The Windows build uses the system WebView2 runtime.

## Start

Extract the Windows package and launch `Patchbay.exe` alongside `WebView2Loader.dll`. The app opens an example rack on first launch. Select **Open** to choose a project or a supported Excel workbook. On Windows, dropping a project onto the executable also opens it. **Project files → New empty project** starts a different installation.

An open project can be saved with **Ctrl+S**. **Ctrl+Shift+S** writes a separate copy. A session recovery copy is kept in the local WebView profile. Use the portable project file for backup and transfer.

## Operate the rack

- Choose **Front** or **Rear**. Select a device and use the inspector to edit a port, trace its far end or repatch a cable. **Pick on rack** lets you select a destination on either face.
- **Edit ports** opens the device faceplate. Click a dashed slot to add a port, or use **Add port** to append one to the selected row. **Insert gap before** shifts ports on that row by exactly one slot. Drag a port or use **Move or swap** to change its position. **Paste labels** adds several named ports to one row. **Save layout** commits the staged changes together.
- To remove a row or column, click its heading and choose the numbered **Remove row** or **Remove column** button below the grid. Empty rows and columns are removed immediately in the editor. If the selection contains unpatched ports, review their labels and confirm. Move connected ports to another row or column first. **Undo** restores a saved layout change.
- For a new device, choose **Custom grid** to start with empty rows and columns. The device type picker includes network, power, storage and passive equipment, plus **Custom device type**. Duplicating a device preserves its physical port arrangement.
- Select **Edit port** to set its condition to Working, Broken, Disabled or Unknown and add a fault note. Broken and disabled ports retain existing cable records and are excluded from new patches. **Port conditions** finds matching ports across both faces, including unpatched ones. Previously saved and imported ports start as Unknown.
- Use **Edit device** to set its bottom U and height. **Show all U** exposes empty slots for clicks or drag and drop. Rack occupancy is checked per face. Check front-to-rear depth clearance at the physical cabinet.
- Choose **Work plan → Create draft** before experimenting with the target layout. The checklist compares the current installation with the draft. Review the changes, check completed work, then apply the draft.
- In **Cable details**, choose copper categories including Cat 5 and Cat 5e, an SFP-family DAC or AOC assembly, a multimode or single-mode fibre patch lead, or **Custom type**. Existing custom names are preserved. The selected type carries through to the cable list.
- Enter **Cabinet depth (mm)** in **Rack settings**. Once both devices are placed, the estimate adds vertical travel and routing slack. A cross-face run adds one cabinet depth. **Cable length estimates → Measured cable path** can use the measured crossing instead. With unknown depth, the existing crossing allowance applies. The suggested stock length only updates a cable when you select **Use** and save it.
- **Connections → Print labels** prints both ends of each cable. **Cable list** groups material quantities. The operating system print dialog controls paper and printer options.
- Press **?** to see shortcuts. Keyboard editing and menus provide alternatives to dragging.

## Excel migration

The importer recognises the ServerSchrank illustrated layout with S, P and C device blocks in column B. It reads labels, cell fills, workbook notes and the colour legend. It keeps direct reciprocal matches as one connection. Unambiguous one-sided links are marked for review. Unresolved names, conflicts, pending cells and open ends remain traceable to their source cells. Checkbox values remain source annotations.

For the supplied project, S0-S3 and P1-P6 are front-facing. P7-P9 and C1-C3 are rear-facing. Cabinet height defaults to 24U, device height defaults to 1U, and positions start unplaced. Confirm all three at the cabinet. Imported cables start as existing stock and their physical colour and length are unspecified.

## Build from source

Install the Windows Tauri 2 prerequisites, including Rust, a linker and WebView2. From this folder run:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml --locked --release
```

The release executable is built under `src-tauri/target/release` unless `CARGO_TARGET_DIR` overrides that path. For a Windows GNU build, ship the adjacent `WebView2Loader.dll` with the executable. The frontend in `web/` is embedded during compilation. It uses standard JavaScript and the bundled JSZip dependency. No frontend build or network access is needed to run the finished app.

The native layer handles project selection and atomic file replacement. The frontend owns model validation, device layout, workbook import, change comparison and print views.

[Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/)
