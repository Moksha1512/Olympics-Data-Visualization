library(shiny)
library(ggplot2)
library(dplyr)
library(treemapify)
library(highcharter)
library(tidyr)
library(wordcloud2)
library(plotly)
library(wordcloud)
library(RColorBrewer)
library(tm)

athleteEvents <- read.csv("athleteEvents1.csv")
athleteEvents <- athleteEvents[!is.na(athleteEvents$Medal), ]

ui <- fluidPage(
  tags$head(
    tags$script(HTML('
      $(document).on("click", "input[type=checkbox]", function() {
        var checkboxes = $("input[type=checkbox]");
        var checked = checkboxes.filter(":checked");
        if (checked.length === 0) {
          $(this).prop("checked", true);
        }
      });
    ')),
    tags$style(HTML("
      .custom-border {
        border: 2px solid grey;
        padding-top: 3px;
        margin-bottom:7 px;
        border-radius:15px;
        font-family: 'Times New Roman', Times, serif;
      }
      .custom-margin {
        margin-bottom:-40px;
        padding-bottom:-2px;
      }
      .custom-bg {
        background-color: #f0f0f0; 
      }
      .custom-radio-buttons {
        display: inline-block;
      }
      .mar {
  border: 2px solid grey;
  border-radius:20px;
  border-radius: 5px; 
  padding: 5px; 
  marigin-right:2px;
}

    "))
  ),
  fluidRow(
    column(width = 12, 
           tags$h3(
             "120 YEARS OF OLYMPICS DATA VISUALIZATION", 
             style = "text-align: center; margin-bottom: 2px;marigin-top:-2px; font-family: 'Times New Roman', Times, serif;",
             img(src = "images/logo.jpg", width = 65, height = 30),
           )
    )
  ),
  fluidRow(
    column(width = 12, class = "custom-border custom-bg",
           column(width = 2,
                  tags$label("Select Sport:", class = "custom-margin"),
                  selectInput("sport_dropdown", "",
                              choices = c("All Sports", unique(athleteEvents$Sport)),
                              selected = "All Sports")
           ),
           column(width = 2,
                  tags$label("Select Team:", class = "custom-margin"),
                  selectInput("team_dropdown", "",
                              choices = c("All Teams", unique(athleteEvents$Team)),
                              selected = "All Teams")
           ),
           column(width = 2,
                  tags$label("Select Category:", class = "custom-margin"),
                  selectInput("column_select", "",
                         choices = c("Age", "Height", "Weight"),
                         selected = "Age")
           ),
           column(width = 2,
                  tags$label("Select Medal:", class = "custom-margin"),
                  checkboxGroupInput("medal_checkbox", "",
                                     choices = unique(athleteEvents$Medal),
                                     inline = TRUE,
                                     selected = c("Gold", "Silver", "Bronze"))
           ),
           column(width = 2,
                  tags$label("Select Season:", class = "custom-margin"),
                  div(class = "custom-radio-buttons",
                      radioButtons("season_radio", "",
                                   choices = c("Summer", "Winter"),
                                   inline = TRUE,
                                   selected = "Summer")
                  )
           ),
           column(width = 2,
                  tags$label("Select Year Range:", class = "custom-margin"),
                  sliderInput("year_slider", "",
                              min = min(athleteEvents$Year),
                              max = max(athleteEvents$Year),
                              value = c(min(athleteEvents$Year), max(athleteEvents$Year)))
           )
    )
  ),
  fluidRow(
    column(width = 6,class="mar",
           plotlyOutput("sportPlot", height = "230px")
    ),
    column(width = 6, class="mar",
           plotlyOutput("treemap", height = "230px")
    ),

    column(width = 5, class="mar",
           plotlyOutput("medalPlot", height = "230px")
    ),
    column(width = 3, class="mar",
      plotlyOutput("boxPlot", height = "230px")
    ),
    column(width = 4,class="mar",
           plotlyOutput("totalMedalsPlot", height = "230px")
    ),
    column(width = 12,
           tags$div(id = "message_text", style = "text-align: center; margin-top: 20px;")
    )
  )
)

server <- function(input, output) {

  filtered_data <- reactive({
    data <- athleteEvents
    
    if (input$sport_dropdown != "All Sports") {
      data <- data[data$Sport == input$sport_dropdown, ]
    }
    if (input$team_dropdown != "All Teams") {
      data <- data[data$Team == input$team_dropdown, ]
    }
    data <- data[data$Year >= input$year_slider[1] & data$Year <= input$year_slider[2], ]
    if (!is.null(input$medal_checkbox) && length(input$medal_checkbox) > 0) {
      data <- data[data$Medal %in% input$medal_checkbox, ]
    }
    data <- data[data$Season == input$season_radio, ]
    
    noc_event_counts <- aggregate(Event ~ NOC + Sport, data = data, FUN = function(x) length(unique(x)))
    
    top_sports <- noc_event_counts %>%
      group_by(Sport) %>%
      summarise(Total_Events = sum(Event)) %>%
      top_n(100, Total_Events)
    
    data <- data[data$Sport %in% top_sports$Sport, ]
    
    data
  })
  
  
  sports_per_noc <- reactive({
    data <- filtered_data()
    noc_counts <- aggregate(cbind(Sports = Sport, Events = Event) ~ NOC, data = data, FUN = function(x) length(unique(x)))
    
    noc_counts <- noc_counts[order(noc_counts$Events, decreasing = TRUE), ]
    noc_counts <- noc_counts[1:15, ]
    
    noc_counts
  })
  
  output$sportPlot <- renderPlotly({
    data <- sports_per_noc()
    plot_ly(data, x = ~NOC) %>%
      add_markers(y = ~Sports, name = "Number of Sports", marker = list(color = "blue")) %>%
      add_markers(y = ~Events, name = "Number of Events", marker = list(color = "red")) %>%
      layout(
        title = "Number of Sports and Events for Top-15 Countries",
        xaxis = list(title = "NOC", tickangle = 0, 
                     tickfont = list(size = 9)), 
        yaxis = list(title = "Count"),
        showlegend = TRUE
      )  
  })
  
  
  
  
  medals_per_country <- reactive({
    filtered_data <- filtered_data()  
    
    if (is.null(filtered_data()) || nrow(filtered_data()) == 0) {
      return(data.frame(NOC = character(0), Gold = integer(0), Silver = integer(0), Bronze = integer(0)))
    }
    
    medal_counts <- filtered_data() %>%
      group_by(NOC, Medal) %>%
      summarise(Count = n(), .groups = "drop") %>%
      filter(NOC %in% sports_per_noc()$NOC)  
    medal_counts <- complete(medal_counts, NOC, Medal, fill = list(Count = 0))
    medals_summary <- medal_counts %>%
      group_by(NOC) %>%
      summarise(
        Gold = sum(Count[Medal == "Gold"]),
        Silver = sum(Count[Medal == "Silver"]),
        Bronze = sum(Count[Medal == "Bronze"]),
        .groups = "drop"
      )
    
    medals_summary
  })
  
  

  output$medalPlot <- renderPlotly({
    medals_data <- medals_per_country()
    medals_data_long <- pivot_longer(
      medals_data,
      cols = c(Gold, Silver, Bronze),
      names_to = "Medal",
      values_to = "Count"
    )
    
    medal_colors <- c(Bronze = "#B8860B", Silver = "#C0C0C0", Gold = "#FFD700")
    medal_labels <- c(Bronze = "Bronze", Silver = "Silver", Gold = "Gold")
    medals_data_long$Medal <- factor(medals_data_long$Medal, levels = c("Bronze", "Silver", "Gold"))
    
    plot_ly(data = medals_data_long, x = ~Count, y = ~NOC, type = "bar", orientation = "h",
            color = ~Medal, colors = medal_colors,
            hoverinfo = "text") %>%
      layout(
        title = "Number of Medals per Country",
        xaxis = list(title = "Number of Medals"), 
        yaxis = list(title = "Country"),  
        barmode = "stack",
        legend = list(title = "Medal")  
      )   
  })
  
  
  output$treemap <- renderPlotly({
    req(filtered_data())
    
    sport_medals <- filtered_data() %>%
      group_by(Sport) %>%
      summarise("Total Medals" = n(), .groups = "drop")
    
    sport_medals <- sport_medals %>% arrange(desc(`Total Medals`))
    plot_ly(
      data = sport_medals,
      type = "treemap",
      labels = ~paste(Sport, `Total Medals`, sep = "<br>"),
      parents = ~"",
      values = ~`Total Medals`,
      branchvalues = "total",
      colors = RColorBrewer::brewer.pal(min(12, length(unique(sport_medals$Sport))), "Set2")  
    ) %>%
      layout(
        title = "Total Medals by Sport",
        margin = list(l = 5, r = 5, t = 30, b = 5),  
        font = list(family = "Arial", size = 14),  
        paper_bgcolor = "rgba(0,0,0,0)",  
        plot_bgcolor = "white",  
        hoverlabel = list(bgcolor = "white", font = list(family = "Arial", size = 12)) 
      )   
  })
  
  
  output$totalMedalsPlot <- renderPlotly({
    req(filtered_data())
    
    male_data <- filtered_data() %>% filter(Sex == "M")
    female_data <- filtered_data() %>% filter(Sex == "F")
    total_medals_over_years <- filtered_data() %>%
      
      group_by(Year) %>%
      summarise(Total_Medals = n(),
                Male_Medals = sum(Sex == "M"),
                Female_Medals = sum(Sex == "F"),
                .groups = "drop")
    plot_ly(total_medals_over_years, x = ~Year) %>%
      add_lines(y = ~Total_Medals, name = "Total", line = list(color = "gray", width = 1.5, opacity = 0.5)) %>%
      add_lines(y = ~Male_Medals, name = "Male", line = list(color = "blue", width = 1, opacity = 0.5)) %>%
      add_lines(y = ~Female_Medals, name = "Female", line = list(color = "red", width = 1, opacity = 0.5)) %>%
      layout(title = "Number of Medals Over Years by Gender",
             xaxis = list(title = "Year", color = "black"), 
             yaxis = list(title = "Number of Medals", color = "black"), 
             showlegend = TRUE)  
  })
  
  
  
  filtered_data_column <- reactive({
    data <- filtered_data()
    column_name <- input$column_select
    column_data <- switch(column_name,
                          "Age" = athleteEvents$Age,
                          "Height" = athleteEvents$Height,
                          "Weight" = athleteEvents$Weight)
    data <- data.frame(Column = column_data[!is.na(column_data)])
    
    data
  })
  
  
  output$boxPlot <- renderPlotly({
    data <- filtered_data_column()
    
    color <- ifelse(input$column_select == "Height", "darkgreen",
                    ifelse(input$column_select == "Weight", "red", "blue"))
    fill <- ifelse(input$column_select == "Height", "lightgreen",
                   ifelse(input$column_select == "Weight", "pink", "skyblue"))
    
    p <- ggplot(data, aes(x = "", y = Column)) +
      geom_boxplot(fill = fill, color = color, outlier.colour = "gray", outlier.shape = 2) +
      labs(x = "", y = input$column_select,   
           color = "black", size = 15) + 
      ggtitle(paste("Box Plot of", input$column_select)) +
      theme_minimal() +
      theme(plot.title = element_text(color = "gray"))  
    ggplotly(p)
  })
}

shinyApp(ui = ui, server = server)

