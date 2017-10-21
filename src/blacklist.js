const Url = require("url");

const blacklist = {
  'www.google-analytics.com': true,
  'api.mapbox.com': true,
  'a.tiles.mapbox.com': true,
  'b.tiles.mapbox.com': true,
}

const isInBlacklist = url => blacklist[Url.parse(url).hostname]

module.exports = {isInBlacklist}
