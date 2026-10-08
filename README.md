# Neya extension

Choose clothing on a shopping page and see it on you in the [Neya studio](https://neya-eight.vercel.app).

## Install

1. Download the ZIP from the [latest release](https://github.com/MalyajNailwal/neya-extension/releases/latest) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.
3. Pin Neya, open a clothing store, and choose **Open Browse & Try On** in the extension popup.
4. Pick a clothing photo, open the live mirror, sign in, and enable your camera to start trying on.

To update, replace the files in your existing extension folder, reload Neya on the extensions page, and refresh your shopping tabs. Keeping the same folder avoids changing an unpacked extension's identity unnecessarily.

To install from this repository, load the `extension/` folder. Its default studio is `https://neya-eight.vercel.app`; you can change the Studio URL in the extension popup settings.

## Picking an image

Click **Change** in the side panel or **Pick image** on the store page. Hover over a large clothing photo, then click it to select. Press Escape to stop picking. If the picker is unavailable after an extension update, refresh the shopping tab first.

## Privacy and support

Read the [privacy policy](PRIVACY.md) before using the camera or creating an account. For help, [open an issue](https://github.com/MalyajNailwal/neya-extension/issues). Never post passwords, access tokens, camera images, or personal account information in a public issue.

This repository contains the public extension source and release downloads. It is maintained through an automated one-way mirror; report suggested changes in an issue.

## License

The extension source is licensed under [Apache 2.0](LICENSE).
