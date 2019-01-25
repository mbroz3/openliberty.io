/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

var target;
var code_sections = {}; // Map guide sections to code blocks to show on the right column. Each guide section maps to its tab and code block.
var recent_sections = {}; // Store the most recently viewed code_section for each guide section

// Map the hotspots for a given file to what index the file is in that section.
// Input: Code_block: the code file
//        Header: the section header for this code file
//        Index: the index of the file in this section
function link_hotspots_to_file(code_block, header, index){
    // Check how many code_column are present in this subsection.
    var sect = code_block.parents('.sect1');
    var num_files = $(header).siblings('.code_column').length;   
    var hotspots;
    if(num_files === 1){
        hotspots = sect.find('code[class*=hotspot], span[class*=hotspot], div[class*=hotspot]');
    }
    else {
        // Find only the hotspots above this code block.
        hotspots = code_block.prevUntil('.code_column', 'code[class*=hotspot], span[class*=hotspot], div[class*=hotspot]');
        hotspots = hotspots.add(code_block.prevUntil('.code_column', '.paragraph').find('code[class*=hotspot], span[class*=hotspot], div[class*=hotspot]'));
    }
    hotspots.each(function(){
        $(this).data('file-index', index);
    });
}

// Highlights a block of code in a code section
// Input code_section: The section of code to highlight.
//       from_line: Integer for what line to start highlighting from.
//       to_line: Integer for what line to end highlighting.
//       scroll: boolean if the code should be scrolled to
function highlight_code_range(code_section, fromLine, toLine, scroll){
    // Wrap each leftover piece of text in a span to handle highlighting a range of lines.
    code_section.find('code').contents().each(function(){
        if (!$(this).is('span')) {
                var newText = $(this).wrap('<span class="string"></span>');
                $(this).replaceWith(newText);
        }
    });
    
    // Wrap code block lines in a div to highlight
    var highlight_start = code_section.find('.line-numbers:contains(' + fromLine + ')').first();
    var highlight_end = code_section.find('.line-numbers:contains(' + (toLine + 1) + ')').first();        
    var range = highlight_start.nextUntil(highlight_end);
    range.wrapAll("<div class='highlightSection'></div>");

    if(scroll){
        var scrollTop = $("#code_column_content")[0].scrollTop;
        var position = range.position().top;
        $("#code_column_content").animate({scrollTop: scrollTop + position - 50});
    }        
}

// Remove all highlighting for the code section.
function remove_highlighting(){
    var highlightedSections = $('.highlightSection');
    highlightedSections.each(function(){
        var children = $(this).find('span');
        children.unwrap(); // Remove the wrapped highlighted div from these children.
    });
    
}

// Creates a clone of the code highlighted by hotspots in desktop view, so that they can be shown in mobile.
// Inputs: snippet: Hotspot in the guide column.
//         code_block: The source code block.
//         fromLine: The line in the code block to start copying from.
//         toLine: The line in the code block to end copying.
function create_mobile_code_snippet(snippet, code_block, fromLine, toLine){
    var duplicate_code_block = code_block.clone();
    duplicate_code_block.removeClass('dimmed'); // Remove the blur from the original code block;
    duplicate_code_block.addClass('mobile_code_snippet'); // Add class to this code snippet in the guide column to only show up in mobile view.
    duplicate_code_block.removeClass('code_columnn');
    duplicate_code_block.removeAttr('filename');
    duplicate_code_block.find('.code_column_title_container').remove();

    // Wrap each leftover piece of text in a span to handle selecting a range of lines.
    duplicate_code_block.find('code').contents().each(function(){
        if (!$(this).is('span')) {
            var newText = $(this).wrap('<span class="string"></span>');
            $(this).replaceWith(newText);
        }
    });
    var first_span = duplicate_code_block.find('.line-numbers:contains(' + fromLine + ')').first();
    var last_span = duplicate_code_block.find('.line-numbers:contains(' + (toLine + 1) + ')').first();

    // Remove spans before the first line number and after the last line number
    if(first_span.length > 0){
        first_span.prevAll('span').remove();            
    }
    if(last_span.length > 0){
        last_span.nextAll('span').remove();
    }
    snippet.after(duplicate_code_block);
}

// Returns the header of the element passed in. This checks if the element is in a subsection first before checking the main section header.
function get_header_from_element(element){
    var header;
    var subsection = element.parents('.sect2');
    if(subsection.length > 0){
        header = subsection.find('h3')[0];
    }
    else{
        var section = element.parents('.sect1').first();
        header = section.find('h2')[0];
    }  
    return header;
}

// Returns the code block associated with a code hotspot.
// Inputs: hotspot: The 'hotspot' in desktop view where hovering over the block will highlight certain lines of code in the code column relevant to what the guide is talking about.
function get_code_block_from_hotspot(hotspot){
    var header = get_header_from_element(hotspot);
    var fileIndex = hotspot.data('file-index');
    if(!fileIndex){
        fileIndex = 0;
    }
    return code_sections[header.id][fileIndex].code;
}

// Hide other code blocks and show the correct code block based on provided id.
function showCorrectCodeBlock(id, index, switchTabs) {
    if(!id){
        // At the start of the guide where there is no guide section.
        return;
    }
    try{
        if(!index){
            index = 0;
        }
        var tab;
        // Load the most recently viewed tab for this section if viewed before.
        if(recent_sections[id]){
            tab = recent_sections[id].tab;
            index = tab.data('file-index');                
        }
        var code_block = code_sections[id][index].code;
        if(code_block){
            $('#code_column .code_column').not(code_block).hide();
            code_block.show();
            if(switchTabs){
                // Load all of the tabs for this section
                var subsection_files = code_sections[id];
                for(var i = subsection_files.length - 1; i >= 0; i--){
                    setActiveTab(subsection_files[i].tab);
                }
                if(recent_sections[id]) {
                    setActiveTab(tab);
                }
            }
            hideDuplicateTabs(id);
        }
    } catch(e) {
        console.log(e);
    }
}

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate){
                func.apply(context, args);
            }
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow){
            func.apply(context, args);
        } 
    };
}

/**
 * Handle hovering over hotspots. This will look up the corresponding code section on the right and search for the lines to highlight. Debounce is used to prevent multiple hotspots from being hovered over quickly and having the page jump around. It will handle the latest hotspot hovered over once 250 ms has passed.
 * @param hotspot: The snippet hovered over in the guide column.
 * @param highlightCode: boolean if the code should be highlighted
 */
var handleHotspotHover = debounce(function(hotspot, highlightCode){
    // Only highlight the code if the mouse is still hovered over the hotspot after the debounce.
    if(hotspot.data('hovering') == false){
        return;
    }
    $("#github_clone_popup_container").data('hotspot-hovered', true); // Track if a hotspot was hovered over to hide the github popup
    hideGithubPopup();
    var header = get_header_from_element(hotspot);
    var fileIndex = hotspot.data('file-index');
    if(!fileIndex){
        fileIndex = 0;
    }
    var code_block = code_sections[header.id][fileIndex].code;
    if(code_block){            
        // Save the code section for later when the user comes back to this section and we want to show the most recent code viewed.
        recent_sections[header.id] = code_sections[header.id][fileIndex];                
        // Switch to the correct tab
        var tab = code_sections[header.id][fileIndex].tab;
        setActiveTab(tab);                   
        showCorrectCodeBlock(header.id, fileIndex, false);            

        // Highlight the code
        if(highlightCode){
            var ranges = hotspot.data('highlight-ranges');
            ranges = ranges.split(',');
            for(var i = 0; i < ranges.length; i++){
                var lines = ranges[i].split('-');
                if(lines.length === 2){
                    var fromLine = parseInt(lines[0]);
                    var toLine = parseInt(lines[1]);
                    var num_Lines = parseInt(code_block.find('.line-numbers').last().text());
                    if(fromLine && toLine){              
                        // If a hotspot refers to a whole file, do not highlight it.    
                        if(!(fromLine === 1 && toLine === num_Lines)){               
                            // When multiple ranges are going to be highlighted, only scroll to the first one.                 
                            var shouldScroll = (i === 0);
                            highlight_code_range(code_block, fromLine, toLine, shouldScroll);
                        }                            
                    }
                }                
            }
        }            
    }
}, 250);

function showGithubPopup(){
    $("#github_clone_popup_container").fadeIn();
    $("#code_column .code_column, #code_column_tabs_container").addClass('dimmed', {duration:400});
    $('.code_column_tab').attr('disabled', true);
    $(".copyFileButton").hide();
}

function hideGithubPopup(){
    $("#github_clone_popup_container").fadeOut();
    $("#code_column .code_column, #code_column_tabs_container").removeClass('dimmed', {duration:400});
    $('.code_column_tab').attr('disabled', false);
    $(".copyFileButton").show();
}

/*
   Handle showing/hiding the Github popup.
*/
function handleGithubPopup() {
    var githubPopup = $("#github_clone_popup_container");
    if(githubPopup.length > 0){
        // Check if the first guide section that has code to show on the right has been scrolled past yet.
        // If so, then the Github popup will be dismissed. If the first section hasn't been scrolled past yet but a hotspot is showing on the next section then also hide it.
        var firstCodeSection = $('[data-has-code]').first();
        if(firstCodeSection.length === 0){
            showGithubPopup();
            return;
        }
        if(firstCodeSection.is('h3')){
            firstCodeSection = firstCodeSection.parents('.sect1').find('h2').first();
        }
        var firstCodeSectionTop = Math.round(firstCodeSection[0].getBoundingClientRect().top);
        var navHeight = $('.navbar').height();
        var blurCodeOnRight = (firstCodeSectionTop - navHeight) > 1;

        var firstHotspot = $("#guide_column .hotspot:visible")[0];
        var firstHotspotRect = firstHotspot.getBoundingClientRect();
        var firstHotspotInView = (firstHotspotRect.top > 0) && (firstHotspotRect.bottom <= window.innerHeight);

        // Only show the Github popup if above the first section with code
        // and if hotspots weren't hovered over to reveal the code behind the popup.
        var hotspotHovered = $("#github_clone_popup_container").data('hotspot-hovered');
        if(blurCodeOnRight && !(firstHotspotInView && hotspotHovered)){
            showGithubPopup();
        }
        else{            
            hideGithubPopup();         
        }
    }                
}

// Look through current step's tabs and if a duplicate file was already shown then hide it.
function hideDuplicateTabs(id){
    var visibleTabs = $('#code_column_tabs li:visible');
    var substeps = $("#" + id).parents('.sect1').find('h2, h3');
    var substepIds = [];
    for(var i = 0; i < substeps.length; i++){
        substepIds.push(substeps[i].id);
    }

    // Now check to see if any of the visible tabs match the section's tabs
    visibleTabs.each(function(){
        if(!$(this).is(":visible")){
            // The tab could have been hidden by a previous iteration so only look for duplicates if it is visible.
            return;
        }
        var fileName = this.textContent;
        var fileIndex = $(this).data('file-index');
        var data_id = $(this).attr('data-section-id');
        var code_block = $($("#code_column .code_column[data-section-id='" + data_id + "']").get(fileIndex));

        var tabsWithSameName = $('#code_column_tabs li:visible').not($(this)).filter(":contains('" + fileName + "')");
        if(tabsWithSameName.length > 0){
            // Compare to other tabs in this section to see if their content matches
            tabsWithSameName.each(function(){
                if($(this).find('a').hasClass('active')){
                    return;
                }
                var fileIndex2 = $(this).data('file-index');
                var data_id2 = $(this).attr('data-section-id');
                var code_block2 = $($("#code_column .code_column[data-section-id='" + data_id2 + "']").get(fileIndex2));

                if(substepIds.indexOf(data_id2) === -1){
                    // Tab is not associated with this subsection so hide it.             
                    $(this).hide();
                }
                else {
                    // Other tab is from the same section, compare file contents to determine if it is a duplicate.
                    if(code_block.text() === code_block2.text()){          
                        $(this).hide();
                    }            
                }
            });
        }     
    });
}

function loadPreviousStepsTabs(){
    // Reveal the files from previous sections in case the user loaded a later step from a bookmarked hash.
    var lastTab = $('#code_column_tabs li:visible').last();
    var previousHiddenTabs = lastTab.prevAll().not(":visible");
    for(var i = previousHiddenTabs.length - 1; i >= 0; --i){
        var tab = previousHiddenTabs.get(i);
        var fileName = tab.innerText.trim();
        // Check that the most recent tab for this file is showing.
        if($('#code_column_tabs li:visible').filter(":contains('" + fileName + "')").length == 0){
            $(tab).show();
        }
    }
};

// Sets the active tab in the code column and moves it to the front of the tab list.
// activeTab: tab to set active
function setActiveTab(activeTab){
    if(activeTab.children('a').hasClass('active')){
        return;
    }
    $('.code_column_tab > a').removeClass('active');
    activeTab.children('a').addClass('active');
    activeTab.show();

    // Adjust the code content to take up the remaining height
    var tabListHeight = $("#code_column_title_container").outerHeight();
    $("#code_column_content").css({
        "height": "calc(100% - " + tabListHeight + "px)"
    });
}



 $(document).ready(function() {   
    // Move the code snippets to the code column on the right side.
    // Each code section is duplicated to show the full file in the right column and just the snippet of code relevant to the guide in the left column in single column / mobile view.
    $('.code_column').each(function(){
        var code_block = $(this);        
        var metadata_sect = code_block.prev().find('p');
        if(metadata_sect.length > 0){
            var fileName = metadata_sect[0].innerText;

            // Clone this code block so the full file can be shown in the right column and only a duplicate snippet will be shown in the single column view or mobile view.
            // The duplicated code block will be shown on the right column.
            var duplicate_code_block = code_block.clone();
            code_block.hide();

            var header = get_header_from_element(code_block);            
            header.setAttribute('data-has-code', 'true');
            var code_section = {};
            code_section.code = duplicate_code_block;   
            code_section.fileName = fileName;                    

            // Create a title pane for the code section
            duplicate_code_block.attr('fileName', fileName);

            // Set data attribute for id on the code block for switching to the code when clicking its tab
            duplicate_code_block.attr('data-section-id', header.id);

            // Create a tab in the code column for this file.
            var tab = $("<li class='code_column_tab' role='presentation' tabindex='0'></li>");
            tab.attr('data-section-id', header.id);
            var anchor = $("<a>" + fileName + "</a>");
            tab.append(anchor);

            code_section.tab = tab;

            if(!code_sections[header.id]){
                code_sections[header.id] = []; // Create list of code blocks associated with this subsection
            }
            code_sections[header.id].push(code_section);

            // Map the hotspots and tabs in this section to the index of this file in its given guide section.
            var fileIndex = code_sections[header.id].length-1;
            link_hotspots_to_file(code_block, header, fileIndex);
            tab.data('file-index', fileIndex);

            // Remove old title from the DOM
            metadata_sect.detach();            

            // If the same tab exists already in the list, append it in the same order to persist the order it was introduced in the guide.
            var tabAlreadyExists =  $('#code_column_tabs li').filter(":contains('" + fileName + "')");
            if(tabAlreadyExists.length > 0){
                tabAlreadyExists.last().after(tab);
            } else {
                $('#code_column_tabs').append(tab);
            }            

            duplicate_code_block.addClass('dimmed'); // Dim the code at first while the github popup takes focus.
            duplicate_code_block.appendTo('#code_column_content'); // Move code to the right column
        }
    });

        

    // Map the guide sections that don't have any code sections to the previous section's code. This assumes that the first section is what you'll learn which has no code to show on the right to begin with.
    var sections = $('.sect1:not(#guide_meta):not(#related-guides) > h2, .sect2:not(#guide_meta):not(#related-guides) > h3');
    var first_section = sections[0];
    var first_code_block = $("#code_column .code_column").first();    
    var first_code_section = {};
    first_code_section.code = first_code_block;
    first_code_section.tab = $('.code_column_tab').first();
    code_sections[first_section.id] = [];
    code_sections[first_section.id].push(first_code_section);
    
    for(var i = 1; i < sections.length; i++){
        var id = sections[i].id;
        if(!code_sections[id]){
            var previous_id = sections[i-1].id;
            code_sections[id] = [];
            for(var j = 0; j < code_sections[previous_id].length; j++){
                code_sections[id].push(code_sections[previous_id][j]);
            }                        
        }
    }    

    // Hide all code blocks except the first
    $('#code_column .code_column:not(:first)').hide();
    $('.code_column_tab').hide();
    setActiveTab($('.code_column_tab').first());

    // Load the correct tab when clicking
    $('.code_column_tab').on('click', function(){
        if(!$(this).attr('disabled')){
            var fileIndex = $(this).data('file-index');
            setActiveTab($(this));

            // Show the code block
            var data_id = $(this).attr('data-section-id');
            var code_block = $($("#code_column .code_column[data-section-id='" + data_id + "']").get(fileIndex));
            // Save the code section for later when the user comes back to this section and we want to show the most recent code viewed.
            recent_sections[data_id] = code_sections[data_id][fileIndex];
            $('#code_column .code_column').not(code_block).hide();
            code_block.show();
        }
    });

    $('.code_column_tab').on('keydown', function(e){
        if(e.which === 13){
            $(this).trigger('click');
        }
    });

    

    // Parse the hotspot lines to highlight and store them as a data attribute.
    $('code[class*=hotspot], span[class*=hotspot], div[class*=hotspot]').each(function(){
        var snippet = $(this);
        var classList = this.classList;
        var line_nums, ranges;
        for(var i = 0; i < classList.length; i++){
            var className = classList[i];
            if(className.indexOf('hotspot=') === 0){
                line_nums = className.substring(8);
                var fromLine, toLine;
                if(line_nums.indexOf('-') > -1){
                    var lines = line_nums.split('-');
                    fromLine = parseInt(lines[0]);
                    toLine = parseInt(lines[1]);
                    ranges = line_nums;
                }
                else {
                    // Only one line to highlight.
                    fromLine = parseInt(line_nums);
                    toLine = parseInt(line_nums);
                    ranges = fromLine + "-" + toLine;
                }
                // Set data attributes to save the lines to highlight
                if(snippet.data('highlight-ranges')){
                    // Add lines to the hotspot
                    var old_ranges = snippet.data('highlight-ranges');
                    old_ranges += "," + ranges;
                    snippet.data('highlight-ranges', old_ranges);
                }
                else{
                    snippet.data('highlight-ranges', ranges);
                }                    
                snippet.addClass('hotspot');

                // Find if the hotspot has a file index set to override the default behavior.
                for(var j = 0; j < classList.length; j++){
                    if(classList[j].indexOf('file=') === 0){
                        var fileIndex = classList[j].substring(5);
                        $(this).data('file-index', parseInt(fileIndex));
                    }
                }

                var code_block = get_code_block_from_hotspot(snippet);
                create_mobile_code_snippet(snippet, code_block, fromLine, toLine);
            }  
        }
    });

    

    // When hovering over a code hotspot, highlight the correct lines of code in the corresponding code section.
    $('.hotspot').on('hover mouseover', function(){
        if(inSingleColumnView()){
            return;
        }
        $(this).data('hovering', true);
        var highlightCode = !$(this).hasClass('code_command');
        handleHotspotHover($(this), highlightCode);
    });

    // When the mouse leaves a code 'hotspot', remove all highlighting in the corresponding code section.
    $('.hotspot').on('mouseleave', function(){
        if(inSingleColumnView()){
            return;
        }
        $(this).data('hovering', false);
        remove_highlighting();
    });       

    // Prevent scrolling the page when scrolling inside of the code panel, but not one of the code blocks.
    $('#code_column').on('wheel mousewheel DOMMouseScroll', function(event){
        event.stopPropagation();
        var target = $(event.target);
        if(!(target.is('.code_column') || target.parents('.code_column').length > 0)){   
            // Prevent scrolling the page when scrolling outside of lines of code but still inside of the code column.
            event.preventDefault();
        } 
    });

    // Handle scrolling in the code column.
    // Prevents the default scroll behavior which would scroll the whole browser.
    // The code column scrolling is independent of the guide column.
    $('.code_column').on('wheel mousewheel DOMMouseScroll', function(event){
        if(inSingleColumnView()){
            return;
        }
        $(this).stop(); // Stop animations taking place with this code section.

        var event0 = event.originalEvent;
        var dir = (event0.deltaY) < 0 ? 'up' : 'down';
        var codeColumn = $("#code_column")[0];
        var codeColumnContent = $("#code_column_content").get(0);

        if(!(this.scrollTop > 0 || this.offsetHeight > codeColumnContent.offsetHeight)){
            // Element is not scrollable. If the code file has no scrollbar, the page will still scroll if the event is propagated to the window scroll listener so we need to prevent propagation.
            event.stopPropagation();
            event.preventDefault();
        }

        // If the code column is at the top and the browser is scrolled down, the element has no scrollTop and does not respond to changing its scrollTop.
        else if(!(dir == 'down' && this.parentElement.scrollTop === 0)){
            var delta = event0.wheelDelta || -event0.detail || -event0.deltaY;
            // Firefox's scroll value is always 1 so multiply by 150 to scroll faster.
            if(delta === 1 || delta === -1){
                delta *= 150;
            }
            codeColumnContent.scrollTop -= delta;
            handleGithubPopup();
            event.preventDefault();  
            event.stopPropagation();
        }            
    });

    // Set the github clone popup top to match the first section
    var firstSection = $(".sect1:not(#guide_meta)").first();
    if(firstSection.length > 0){
        var firstSectionTop = firstSection.get(0).offsetTop;
        $("#github_clone_popup_container").css('top', firstSectionTop);
    }

    $(".copyFileButton").click(function(event){
        event.preventDefault();
        target = $("#code_column .code_column:visible .content")[0];
        copy_element_to_clipboard(target, function(){
            var current_target_object = $(event.currentTarget);
            var position = current_target_object.position();	
            $('#code_section_copied_confirmation').css({	
                top: position.top + 30,	
                right: 25	
            }).stop().fadeIn().delay(1000).fadeOut();
        });
    });

    // Handle enter key presses on the copy file button
    $(".copyFileButton").on('keypress', function(event){
        // Enter key
        if(event.key === "Enter"){
            $(this).trigger('click');
        }
    });  

    $(window).on('scroll', function(event) {
        // Check if a scroll animation from another piece of code is taking place and prevent normal behavior.
        if($("body").data('scrolling') === true){
            return;
        }
        handleGithubPopup();
    });

    $(window).on('load', function(){
        resizeGuideSections();

        if (location.hash){
            var hash = location.hash;
            showCorrectCodeBlock(hash.substring(1), null, true);  // Remove the '#' in front of the id
            loadPreviousStepsTabs();
        }

        if(window.location.hash === ""){
            handleGithubPopup();
        }
    });
});