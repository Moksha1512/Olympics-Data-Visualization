// Event listener for the sport dropdown menu
d3.select("#sport-dropdown").on("change", updateMap);
d3.select("#season-dropdown").on("change", updateMap);

var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");

// Map and projection
var path = d3.geoPath();
var projection = d3.geoNaturalEarth()
    .scale(width / 2 / Math.PI)
    .translate([width / 2.5, height / 2]); 
var path = d3.geoPath()
    .projection(projection);

// Define color scale using Blues
var color = d3.scaleSequential(d3.interpolateYellow);

var data;
var world;

d3.queue()
    .defer(d3.json, "http://enjalot.github.io/wwsd/data/world/world-110m.geojson")
    .defer(d3.csv, "combined_dataset2.csv")
    .await(function(error, worldData, csvData) {
        if (error) throw error;
        world = worldData;
        data = csvData;
        color = d3.scaleSequential(d3.interpolateReds)
            .domain([0, 1000]);
        populateSportDropdown(); 
        updateMap(); 
    });
 function populateSportDropdown() {
        var sportDropdown = d3.select("#sport-dropdown");
        var uniqueSports = Array.from(new Set(data.map(function(d) { return d.discipline_title; })));
        sportDropdown.selectAll("option").remove();
        sportDropdown.append("option")
            .attr("value", "All")
            .text("All");
        uniqueSports.forEach(function(discipline_title) {
            sportDropdown.append("option")
                .attr("value", discipline_title)
                .text(discipline_title);
        });
    }
    
    
function updateMap() {
    var selectedSport = document.getElementById("sport-dropdown").value;
    var selectedSeason = document.getElementById("season-dropdown").value;

    // Filter data based on the selected sport and season
    var filteredData;
    if (selectedSport == 'All' && selectedSeason == 'All') {
        filteredData = data;
    } else if (selectedSport == 'All') {
        filteredData = data.filter(function(d) {
            return d.game_season === selectedSeason;
        });
    } else if (selectedSeason == 'All') {
        filteredData = data.filter(function(d) {
            return d.discipline_title === selectedSport;
        });
    } else {
        filteredData = data.filter(function(d) {
            return d.discipline_title=== selectedSport && d.game_season === selectedSeason;
        });
    }

    // Determine the color scale based on the selected season
    if (selectedSeason == 'All') {
        color = d3.scaleSequential(d3.interpolateReds)
            .domain([0, 1000]);
    } else if (selectedSeason == 'Summer') {
        color = d3.scaleSequential(d3.interpolateReds)
            .domain([0, 600]);
    } else {
        color = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, 600]);
    }

    // Call the ready function with the filtered data and color scale
    ready(null, world, filteredData, color);
}


function ready(error, world, data, color) {
    if (error) throw error;
    d3.select("svg").remove();
    var counts = d3.nest()
        .key(function(d) {
            return d.country_name;
        })
        .rollup(function(v) {
            return v.length;
        })
        .object(data);
    var maxCount = d3.max(Object.values(counts));

    var width = 960,
        height = 600;

    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    var path = d3.geoPath();
    var projection = d3.geoNaturalEarth()
        .scale(width / 2 / Math.PI)
        .translate([width / 2.6, height / 1.8]);

    path.projection(projection);


    var map = svg.append("g")
        .selectAll("path")
        .data(world.features)
        .enter().append("path")
        .attr("fill", function(d) {
            var count = counts[d.properties.name] || 0;
            return color(count);
        })
        .attr("stroke", "grey") // Add white stroke for contrast
        .attr("stroke-width", 1) // Set stroke width to 1 pixel
        .attr("d", path)
        .on("mouseover", function(d) {
            // Change opacity and stroke on mouseover
            d3.select(this)
                .style("stroke", "black");

            // Filter the data for the hovered country
            var hoveredCountryData = data.filter(function(country) {
                return country.country_name === d.properties.name;
            });
            // console.log(hoveredCountryData);
            var selectedSport = document.getElementById("sport-dropdown").value;
    var selectedSeason = document.getElementById("season-dropdown").value;

    if (!counts[d.properties.name]) {
        // If the country didn't participate in the selected sport and season
        var sportText = selectedSport === 'All' ? "All sports" : selectedSport;
        var seasonText = selectedSeason === 'All' ? "All seasons " : selectedSeason+" season ";
        svg.append("text")
            .attr("id", "noOlympicsMessage")
            .attr("x", function() {
                return 650;
            })
            .attr("y", function() {
                return 100;
            })
            .attr("text-anchor", "middle")
            .attr("font-size", "15px")
            .attr("fill", "white")
            .text(d.properties.name + " didn't take part in " + sportText + " in the " + seasonText + "of the Olympics");
    } else {
        // If the country participated in at least one sport in the selected season
        svg.append("text")
            .attr("id", "countryName")
            .attr("x", 800)
            .attr("y", 100)
            .attr("text-anchor", "middle")
            .attr("font-size", "30px")
            .attr("fill", "white")
            .text(d.properties.name);
        updateHistogram(hoveredCountryData);
        updatePieChart(hoveredCountryData);
    }
            
        })
        .on("mouseleave", function(d) {
            d3.select(this)
                .style("stroke", "transparent");

            histogramContainer.html("");
            d3.select("#noOlympicsMessage").remove();
            d3.select("#countryName").remove();
            pieContainer.html("");
        });

    var legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(20,45)");

    var legendScale = d3.scaleLinear()
        .domain([0, 600])
        .range([0, 250]);

    var legendAxis = d3.axisBottom(legendScale)
        .ticks(7);

    // Position and style the legend axis
    legend.append("g")
        .attr("class", "legend-axis")
        .attr("transform", "translate(0,20)")
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px")
        .style("fill", "white");

    legend.selectAll(".legend-rect")
        .data(color.ticks(7))
        .enter().append("rect")
        .attr("class", "legend-rect")
        .attr("x", function(d, i) {
            return i * 40;
        })
        .attr("y", 10)
        .attr("width", 40)
        .attr("height", 10)
        .style("fill", function(d) {
            return color(d);
        });

    legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", 0)
        .text("Legend")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "white");
}


var margin = { top: 20, right: 30, bottom: 15, left: 40 },
    width = 200 - margin.left - margin.right,
    height = 220 - margin.top - margin.bottom;

var histogramContainer = d3.select("body").append("div")
.attr("class", "histogram-container")
.style("position", "absolute")
.style("top", "0")
.style("right", "0")
.style("background-color", "black")
.style("padding", "10px");
function updateHistogram(data) {
    histogramContainer.html("");
    if (data.length === 0) {
        d3.selectAll(".histogram-container svg").remove();
        return; // No need to proceed if there's no data
    }

    var x = d3.scaleBand()
        .range([0, width])
        .padding(0.1);

    var y = d3.scaleLinear()
        .range([height, 0]);

    var svg = histogramContainer.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    var counts = {
        GOLD: 0,
        SILVER: 0,
        BRONZE: 0
    };

    data.forEach(function(d) {
        counts[d.medal_type]++;
    });

    var countsArray = Object.keys(counts).map(function(key) {
        return { medal_type: key, count: counts[key] };
    });

    x.domain(countsArray.map(function (d) { return d.medal_type; }));
    y.domain([0, d3.max(countsArray, function (d) { return d.count; })]);

    var colorScale = {
        GOLD: "gold",
        SILVER: "silver",
        BRONZE: "#cd7f32" 
    };

    svg.append("text")
        .attr("x", (width / 2))
        .attr("y", -margin.top)
        .attr("text-anchor", "middle")
        .style("fill", "white")
        .style("font-size", "10px")
        .text("Medal Count");

    svg.selectAll(".bar")
        .data(countsArray)
        .enter().append("rect")
        .attr("class", function (d) { return d.medal_type.toLowerCase() + " bar"; })
        .attr("x", function (d) { return x(d.medal_type); })
        .attr("width", x.bandwidth())
        .attr("y", function (d) { return y(d.count); })
        .attr("height", function (d) { return height - y(d.count); })
        .style("fill", function(d) { return colorScale[d.medal_type]; }) 
        .on("mouseover", function(d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html("Count: " + d.count)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("fill", "white")
        .style("font-size", "8px");

    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("fill", "white"); 

    svg.append("line")
        .attr("x1", 0)
        .attr("y1", height)
        .attr("x2", width)
        .attr("y2", height)
        .style("stroke", "white");

    // Add y-axis line
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", height)
        .style("stroke", "white");
}

var pieChartMargin = { top: 10, right: 30, bottom: 30, left: 40 };
var pieChartWidth = 230 - pieChartMargin.left - pieChartMargin.right; 
var pieChartHeight = 230 - pieChartMargin.top - pieChartMargin.bottom;

var pieContainer = d3.select("body").append("div")
.attr("id", "pie")
.style("position", "absolute")
.style("top", "250px")
.style("right", "0")
.style("background-color", "black")
.style("padding", "20px");

var radius = Math.min(pieChartWidth, pieChartHeight) / 2 ;

function updatePieChart(hoveredCountryData) {
pieContainer.html(""); 
var svg = pieContainer
    .append("svg")
    .attr("width", pieChartWidth)
    .attr("height", pieChartHeight)
    .append("g")
    .attr("transform", "translate(" + pieChartWidth / 2 + "," +  pieChartHeight / 2 + ")");

var maleCount = 0;
var femaleCount = 0;

hoveredCountryData.forEach(function(d) {
    if (d.event_gender == "Men") {
        maleCount++;
    } else if (d.event_gender == "Women") {
        femaleCount++;
    } else if (d.event_gender == "Mixed") {
        maleCount++;
        femaleCount++;
    }
});

var total = maleCount + femaleCount;
var malePercentage = maleCount / total * 100;
var femalePercentage = femaleCount / total * 100;

var pieData = [
    { label: "Men", value: maleCount, percentage: malePercentage.toFixed(1) + "%", color: "blue" },
    { label: "Women", value: femaleCount, percentage: femalePercentage.toFixed(1) + "%", color: "red" }
];

var filteredPieData = pieData.filter(function(d) {
    return parseFloat(d.percentage) > 0;
});

// console.log("Filtered Pie Data:", filteredPieData); // Log filtered data for debugging

var pie = d3.pie()
    .value(function(d) { return d.value; });
var data_ready = pie(filteredPieData);

var arcGenerator = d3.arc()
    .innerRadius(0)
    .outerRadius(radius);

svg.selectAll('mySlices')
    .data(data_ready)
    .enter()
    .append('path')
    .attr('d', arcGenerator)
    .attr('fill', function(d) { return d.data.color; }) // Using custom colors
    .attr("stroke", "black")
    .style("stroke-width", "2px")
    .style("opacity", 0.7);

// Add labels with percentages to the pie chart
svg.selectAll('mySlices')
    .data(data_ready)
    .enter()
    .append('text')
    .text(function(d) { return d.data.percentage; })
    .attr("transform", function(d) { return "translate(" + arcGenerator.centroid(d) + ")"; })
    .style("text-anchor", "middle")
    .style("font-size", 14);

// Legend for Men
var legendContainer = pieContainer // Position the legend relative to the pie container
    .append("div")
    .attr("class", "legend-container")
    .style("position", "absolute")
    .style("top", "10px") // Adjust the top value as needed
    .style("left", "10px") // Adjust the left value as needed
    .style("display", "flex")
    .style("flex-direction", "column"); // Display legend items in a column

// Legend for Men
var legendContainer = pieContainer // Position the legend relative to the pie container
.append("div")
.attr("class", "legend-container")
.style("position", "absolute")
.style("top", "80px") // Adjust the top value as needed
.style("left", "0px") // Adjust the left value as needed
.style("display", "flex")
.style("flex-direction", "column"); // Display legend items in a column

var maleLegendData = [
{ label: "Men", color: "blue" }
];

var maleLegendG = legendContainer.selectAll(".legend")
.data(maleLegendData)
.enter()
.append("div")
.attr("class", "legend")
.style("display", "flex") // Use flexbox to align items horizontally
.style("align-items", "center"); // Align items vertically at the center

maleLegendG.append("div")
.style("width", "10px")
.style("height", "10px")
.style("background-color", function(d) { return d.color; });

maleLegendG.append("div")
.style("margin-left", "5px")
.style("color", "white") // Set text color to white
.text(function(d) { return d.label; });

// Legend for Women
var femaleLegendContainer = pieContainer // Position the legend relative to the pie container
    .append("div")
    .attr("class", "legend-container")
    .style("position", "absolute")
    .style("top", "30px") // Adjust the top value as needed
    .style("left", "10px") // Adjust the left value as needed
    .style("display", "flex")
    .style("flex-direction", "column"); // Display legend items in a column

var femaleLegendData = [
    { label: "Women", color: "red" }
];

var femaleLegendG = femaleLegendContainer.selectAll(".legend")
    .data(femaleLegendData)
    .enter()
    .append("div")
    .attr("class", "legend");

femaleLegendG.append("div")
    .style("display", "inline-block")
    .style("width", "10px")
    .style("height", "10px")
    .style("background-color", function(d) { return d.color; });

femaleLegendG.append("div")
    .style("display", "inline-block")
    .style("margin-left", "5px")
    .style("color", "white") // Set text color to white
    .text(function(d) { return d.label; });
}