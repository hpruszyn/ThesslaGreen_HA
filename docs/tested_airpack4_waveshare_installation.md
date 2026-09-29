# Tested AirPack4 + Waveshare installation

This document describes a real installation used to develop and test the
`feat/airpack-diagnostics` branch of this integration.

It is intended as a known-good hardware reference for Thessla Green AirPack4
users connecting Home Assistant through an RS485-to-Ethernet gateway.

## Hardware

| Component | Device / model | Role |
|---|---|---|
| Heat recovery unit | **Thessla Green AirPack4 500v E** | Main ventilation unit |
| Original controller / network module | **AirMobile** | Thessla Green control interface |
| RS485/Ethernet gateway | **Waveshare RS485 TO POE ETH (B)** | Modbus TCP to Modbus RTU bridge |
| Home automation | **Home Assistant** | Integration, entities and automations |
| Home Assistant host | **QNAP NAS**, containerized Home Assistant | Integration runtime |
| Bathroom humidity sensor | **Aqara** | Triggers bathroom airing automation |
| Window sensors | **Aqara** | Trigger open-window ventilation mode |

## Physical connection

The AirPack4 unit used for testing exposes two RJ45 communication ports.
Both ports were verified to work with Modbus communication on this unit.

The installation currently uses:

```text
Thessla Green AirPack4 500v E
│
├── RJ45 port 10 ─────────────── AirMobile
│
└── RJ45 port 11 ─────────────── Waveshare RS485 TO POE ETH (B)
                                      │
                                      │ Ethernet / LAN
                                      ▼
                                Home Assistant
```

The assignment of AirMobile to port 10 and Waveshare to port 11 is the chosen
installation layout, not a statement that the other port cannot be used.

During initial installation, a "no response" problem turned out to be caused by
the cable/contact rather than by the selected AirPack communication port.

## Waveshare configuration

The following settings are confirmed to work:

| Setting | Value |
|---|---|
| Work Mode | **TCP Server** |
| Protocol | **Modbus TCP to RTU** |
| Serial baud rate | **9600** |
| Data bits | **8** |
| Parity | **None** |
| Stop bits | **1** |
| Device / TCP port | **4196** |
| Modbus slave ID | **10** |

In compact form:

```text
TCP Server
Modbus TCP to RTU
9600 8N1
TCP port: 4196
Slave ID: 10
```

An example gateway address used during development is:

```text
192.168.1.200:4196
```

The IP address is installation-specific and should be replaced with the address
assigned to the Waveshare gateway on the local network.

## Home Assistant integration settings

Example values:

```text
Host:          192.168.1.200
Port:          4196
Slave ID:      10
Scan interval: 30 s
```

Home Assistant communicates with the gateway as a **Modbus TCP client**.
The Waveshare device converts the requests to Modbus RTU on the AirPack RS485
side.

## Development deployment on QNAP

For development, the repository is kept next to the actual Home Assistant
custom-component path and the integration directory is exposed through a
relative symlink.

Repository:

```text
/share/Container/homeassistant/custom_components/ThesslaGreen_HA-dev
```

Home Assistant integration path:

```text
/share/Container/homeassistant/custom_components/thessla_green
```

Recommended layout:

```text
custom_components/
├── ThesslaGreen_HA-dev/
│   ├── custom_components/
│   │   └── thessla_green/
│   ├── tests/
│   └── ...
│
└── thessla_green -> ThesslaGreen_HA-dev/custom_components/thessla_green
```

Example setup:

```bash
cd /share/Container/homeassistant/custom_components

mv thessla_green ThesslaGreen_HA-dev

ln -s \
  ThesslaGreen_HA-dev/custom_components/thessla_green \
  thessla_green
```

Development branch:

```bash
cd /share/Container/homeassistant/custom_components/ThesslaGreen_HA-dev

git fetch origin
git switch feat/airpack-diagnostics
git pull
```

After integration updates, restart Home Assistant.

## Home automation used with this installation

The ventilation system is also controlled from Home Assistant using external
room sensors.

### Bathroom

An Aqara humidity sensor is used to request **Wietrzenie** when bathroom
humidity exceeds the configured threshold.

The integration exposes the relevant AirPack parameters, including:

- airing intensity — holding register `4230`,
- airing duration — holding register `4233`,
- special mode — holding register `4224`.

### Windows

Aqara window sensors are used to request the AirPack **Okna** mode while one or
more monitored windows are open.

The open-window exhaust intensity is configurable through holding register
`4239`.

### Priority automation

This branch contains a Home Assistant blueprint:

```text
blueprints/automation/thessla_green/bathroom_windows_priority.yaml
```

The intended priority is:

```text
open windows
    ↓
bathroom airing
    ↓
normal operation
```

The automation checks the raw special-mode code before clearing bathroom
airing, so it does not intentionally cancel airing activated by a different
AirPack source such as the internal schedule or a physical input.

## Real-device observations

The following behavior has been observed on this installation:

- Modbus communication works through the Waveshare gateway with slave ID 10.
- Both AirPack RJ45 communication ports 10 and 11 were verified to communicate.
- Special mode **Okap** is input-driven on this installation. Writing the value
  directly does not behave like a persistent manually selected mode and the
  controller can immediately return to `Brak trybu`.
- Different AirPack firmware/models may expose different optional register
  ranges. The integration therefore tolerates partial Modbus read failures and
  can validate known registers without brute-forcing the complete address
  space.

## Troubleshooting checklist

If Home Assistant cannot communicate with the AirPack:

1. Verify the physical cable and connector first.
2. Confirm Waveshare is in **TCP Server / Modbus TCP to RTU** mode.
3. Confirm serial settings are **9600 8N1**.
4. Confirm TCP port **4196**.
5. Confirm slave ID **10**.
6. Check that the Waveshare IP is reachable from the Home Assistant network.
7. Verify Home Assistant is pointing at the actual integration directory, not
   at the repository root containing another `custom_components/` directory.
8. Restart Home Assistant after updating integration Python files.

This setup is a real-world reference, not a guarantee that every AirPack model
or firmware revision uses identical capabilities or register availability.
