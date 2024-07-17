<img src="https://i.ibb.co/6Yv6b05/banner.png" />
<p align="center">
    <a href="https://github.com/Blasstah/MCSD/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
    <a href="https://github.com/Blasstah/MCSD"><img src="https://img.shields.io/github/stars/Blasstah/MCSD" alt="MIT License" /></a>
    <a href="https://github.com/Blasstah/MCSD"><img src="https://img.shields.io/github/repo-size/Blasstah/MCSD" alt="MIT License" /></a>
</p>

## What's that?
You can think of it as a set of **various tools to more easily manage a Minecraft Server**. This tool is mainly targeted for people, **who want to quickly setup a server and play with some friends**, and not big server providers. 

> Made primarly using Express, Socket.IO, EJS, Bootstrap and JQuery.

> **Bootstrap theme, Bootstrap icons, CodeMirror and Notyf** are being downloaded from **CDNs**. Check **views/partials/libs** and **views/settings** for links. All of them are being downloaded from **jsDelivr**.

## Features
Keep in mind that the software is in early stages of development and more things will be added, or changed.
- Integrated, web server console
- Player list and count via aquiring game query.
- Web Server properties editor powered by CodeMirror
- Memory and CPU Usage monitoring.
- Mods and plugins management.
- Scheduler, that allows creating tasks at specified day and time. (Messages, executing commands, restarting the server, and doing a backup)
- Optional, integrated FTP Server for easy access to Minecraft server files. Powered by nodeftpd.
- Command Macros, which allow you to execute multiple commands one after another with a click of a button.
- A easy way to code your own modules. Just look at one of them in modules folder.
- Terminal Mode for interacting with the server from SSH or native console. (Still in development, but has some functionality done)

**Everything above is fully customizable via menus**, or by modifing files like **settings.json**, and anything in **config** folder.
(Both of them create at the first run of the app)

## Installation and Setup
0. Install newest version of Node.JS with NPM

1. Clone this repo to some empty directory.
2. Run the app with "npm start" in terminal/cmd/powershell.
3. By default, the website is hosted on "localhost:3000". Open your browser and go to http://localhost:3000.
4. Login to the panel. The default password is "admin". Remember to later change it in the settings!
5. Proceed with the instructions on the page. You however need to download server jar file by yourself, and put it to "mc_server" folder. This app does not download it for you. So get paper, fabric, or anything you want to use.
6. Mess around the menus, set some options, and you're good to go.

## Planned
- Optional Discord Integration (Sending commands via Discord Bot, forwarding messages, and etc.)
- Visual changes, Bug fixes, and etc.