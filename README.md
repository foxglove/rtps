# @foxglove/rtps

> _Real-Time Publish Subscribe (DDS-RTPS) protocol implementation with a pluggable transport layer. This is a subset of the complete specification optimized for ROS 2 (Robot Operating System) connections_

[![npm version](https://img.shields.io/npm/v/@foxglove/rtps.svg?style=flat)](https://www.npmjs.com/package/@foxglove/rtps)

## Usage

```Typescript
...
```

## Notes

Receiving large (>256KB) messages not be possible with the default Linux networking receive buffer size of 256KB, depending on CPU speed / contention / network speed / many factors. Linux users should set the following sysctls:

```
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -w net.core.rmem_default=26214400
sudo sysctl -w net.ipv4.udp_mem=26214400
```

Or permanently in `/etc/sysctl.conf`:

```
net.core.rmem_max=26214400
net.core.rmem_default=26214400
net.ipv4.udp_mem=26214400
```

### Test

`yarn test`

## License

@foxglove/rtps is licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Releasing

1. Run `yarn version --[major|minor|patch]` to bump version
2. Run `git push && git push --tags` to push new tag
3. GitHub Actions will take care of the rest
