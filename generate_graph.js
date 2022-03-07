const fs = require('fs');
const marnet = JSON.parse(fs.readFileSync('./data/marnet_dense.json')).features;
const path = require('ngraph.path');
const createGraph = require('ngraph.graph');
const turf = require('turf');

let coords = [];
marnet.map(feature => {
  if(feature.geometry && feature.geometry.coordinates)
    feature.geometry.coordinates.map(coord => {
      coords.push({
        location: coord,
        hash: getLocationHash(coord)
      })
    });
});

function getLocationHash(coords) {
  return String(coords[0])+","+String(coords[1]);
}

console.log("Got ",coords.length," coordinates in total.");

let uniqueHashes = Array.from(new Set(coords.map(coord => coord.hash)));
console.log("Got ",uniqueHashes.length," unique coordinates.");


let graph = createGraph();

console.time("Added coords to graph.");

uniqueHashes.map(hash => {
  let coord = coords.find(coord => coord.hash === hash);

  graph.addNode(hash, {x:coord.location[0], y: coord.location[1]});
})

console.timeEnd("Added coords to graph.");

console.time("Added edges.");
let edgeCount = 0;

marnet.map(feature => {
  if(feature.geometry && feature.geometry.coordinates) {
    for(let i=1;i<feature.geometry.coordinates.length;i++) {
      graph.addLink(getLocationHash(feature.geometry.coordinates[i-1]), getLocationHash(feature.geometry.coordinates[i]))
      edgeCount++;
    }
  }
});

console.timeEnd("Added edges.");
console.log("Added ",edgeCount," edges.");

let pathFinder = path.aStar(graph, {
  distance(fromNode, toNode) {
    return turf.distance(turf.point([fromNode.data.x, fromNode.data.y]),
                         turf.point([toNode.data.x, toNode.data.y]));
  },
  heuristic(fromNode, toNode) {
    return turf.distance(turf.point([fromNode.data.x, fromNode.data.y]),
                         turf.point([toNode.data.x, toNode.data.y]));
  }
});

function route(pointA, pointB) {
  let closestToA = getClosestPoint(coords, pointA);
  let closestToB = getClosestPoint(coords, pointB);

  console.time("Routing "+pointA+" and "+pointB);
  let route = pathFinder.find(closestToA.hash, closestToB.hash);
  route = route.map(point => [point.data.x, point.data.y])
  console.timeEnd("Routing "+pointA+" and "+pointB);
  return route;
}

function getClosestPoint(coords, point) {
  console.time("*** Finding closest point to "+point);
  let distances = coords.map((coord, index) => ({
    index,
    distance: turf.distance(turf.point(point), turf.point(coord.location))
  }));
  let closest = coords[distances.sort((a,b) => a.distance-b.distance)[0].index];
  console.timeEnd("*** Finding closest point to "+point);
  return closest;
}

console.time("Full routing");
let routeA = route([23.887878124569756, 57.02899934855821], [22.912279265021315, 40.60778596498325]);
let routeB = route([22.912279265021315, 40.60778596498325], [-74.36706778626323, 11.115138670698153]);
let routeC = route([-74.36706778626323, 11.115138670698153], [151.22303590060116, -33.85865171521903]);
let fullRoute = turf.multiLineString([routeA, routeB, routeC]);
console.timeEnd("Full routing");
fs.writeFileSync('tmp/route.geojson', JSON.stringify(fullRoute, null, 2));
console.log("Written.");