# Nvidia Geforce Driver Checker

Checks for new versions of Nvidia GeForce graphics drivers.
If you like, it will download and install.

## Purpose

I created this because I don't like Nvidia Experience and the
website makes you jump through hoops to check for new versions.

## Usage

```
% npm ci
% nmp run check
```

This will check the NVidia website for driver versions, compare
to your installed version, and if there is a new version, download
it and then install it. It used to have notifications and stuff
but that was all removed.

## Game Ready Drivers vs Studio Drivers

This defaults to downloading Studio drivers. Right now there'a lines
at the top of the app.js file that you can comment to change the
url to Game Ready. I could add a parameter but I feel like no one
will be interested in this except me. Who knows.

## Compatibility

This only works on Windows 10 as far as I know, I didn't see much
point in making this cross platform.

## Future 

This was ported to this .NET project because I got tired of having to
update packages constantly in node hell:

[InsidiousForce/NvidiaDriverChecker](https://github.com/InsidiousForce/NvidiaDriverChecker)






