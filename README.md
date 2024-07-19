<img src="https://i.ibb.co/6Yv6b05/banner.png" />
<p align="center">
    <a href="https://github.com/Blasstah/MCSD/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
    <a href="https://github.com/Blasstah/MCSD"><img src="https://img.shields.io/github/stars/Blasstah/MCSD" alt="MIT License" /></a>
    <a href="https://github.com/Blasstah/MCSD"><img src="https://img.shields.io/github/repo-size/Blasstah/MCSD" alt="MIT License" /></a>
</p>

## What's that?
You can think of it as a set of **various tools to more easily manage a Minecraft Server**. This tool is mainly targeted at people, **who want to quickly set up a server and play with some friends**, and not big server providers. 

**It was mainly done as a learning project, so I could learn the basics of Node.JS Web App Development**

> Made primarily using Express, Socket.IO, EJS, Bootstrap and JQuery.

> **<a href="https://bootswatch.com/darkly/">Bootstrap theme (Darkly from Bootswatch)</a>, <a href="https://icons.getbootstrap.com">Bootstrap icons</a>, <a href="https://github.com/codemirror/codemirror5">CodeMirror</a> and <a href="https://github.com/caroso1222/notyf">Notyf</a>** are being downloaded from **CDNs**. Check **views/partials/libs** and **views/settings** for links. All of them are being downloaded from **jsDelivr** and **Cloudflare cdnjs (for CodeMirror)**.

## Features
Keep in mind that the software is in the early stages of development and more things will be added or changed.
- Integrated, web server console
- Player list and count via acquiring game query.
- Web Server properties editor powered by CodeMirror
- Memory and CPU Usage monitoring.
- Mods and plugins management.
- Scheduler, that allows creating tasks at specified day and time. (Messages, executing commands, restarting the server, and doing a backup)
- Optional, integrated FTP Server for easy access to Minecraft server files. Powered by nodeftpd.
- Command Macros, which allow you to execute multiple commands one after another with a click of a button.
- An easy way to code your own modules. Just look at one of them in the modules folder.
- Terminal Mode for interacting with the server from SSH or native console. (Still in development, but has some functionality done)

**Everything above is fully customizable via menus**, or by modifing files like **settings.json**, and anything in **config** folder.
(Both of them were created at the first run of the app)

## Installation and Setup
0. Install the newest version of Node.JS with NPM
1. Clone this repo to some empty directory, and install all required packages via **"npm i"**.
2. Run the app with **"npm start"** in Terminal / CMD / PowerShell.
3. By default, the website is hosted on "*:3000". Open your browser and go to http://localhost:3000.
4. Login to the panel. The default password is "admin". Remember to change it in the settings later!
5. Proceed with the instructions on the page. You however need to download the server jar file by yourself and put it in the "mc_server" folder. This app does not download it for you. So get paper, fabric, or anything you want to use.
6. Mess around the menus, set some options, and you're good to go.

## Planned
- Optional Discord Integration (Sending commands via Discord Bot, forwarding messages, etc.)
- Visual changes, Bug fixes, etc.
- Since I'm still learning, more things could change if I discover a better / more efficient way do to something/

## Bugs and other Issues
If you happen to find some bugs, or things you think could've been changed, create an issue.